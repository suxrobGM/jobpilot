using JobPilot.Terminal.Pilot.Agent;
using JobPilot.Terminal.Pilot.Api;
using JobPilot.Terminal.Pilot.Pairing;

namespace JobPilot.Terminal.Pilot;

public enum CycleStatus
{
    Ok,
    Empty,
    Error,
}

/// <summary>Runs one cycle. It returns the inter-cycle sleep instead of sleeping, so a wake can cut it short.</summary>
/// <param name="checkInterval">Tests pass one at least as long as every wait, so each wait is a single slice.</param>
internal sealed class CycleRunner(IPilotAgent agent, IPilotApi api, TimeProvider time, TimeSpan? checkInterval = null)
{
    // Server-side activity newer than this means the run is working, not stuck.
    public static readonly TimeSpan RecentActivityWindow = TimeSpan.FromMinutes(5);

    private static readonly TimeSpan ResultTimeout = TimeSpan.FromMinutes(20);
    private static readonly TimeSpan CheckInGrace = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan BackoffDelay = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan StartupGrace = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan OtherProviderPoll = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan RefreshRetry = TimeSpan.FromMinutes(1);

    // The user's typing holds new runs this long, so an always-on loop never clears their session.
    public static readonly TimeSpan HoldWindow = TimeSpan.FromMinutes(3);

    // A run that keeps showing activity still hands over to the ladder after this long.
    private static readonly TimeSpan MaxCycleWait = TimeSpan.FromMinutes(60);

    private const int BackoffThreshold = 3;

    // How often a wait asks the server whether the run finished, in case its event was missed.
    private readonly TimeSpan checkInterval = checkInterval ?? TimeSpan.FromMinutes(2);

    private bool holdReported;

    public int ConsecutiveRestarts { get; private set; }

    /// <summary>Sessions that died on their own mid-wait.</summary>
    public int ConsecutiveExits { get; private set; }

    public DateTimeOffset? LastCycleAt { get; private set; }

    public CycleStatus? LastCycleStatus { get; private set; }

    /// <summary>False while paused because the user runs the other provider.</summary>
    public bool Conducting { get; private set; }

    /// <summary>When the user's typing stops holding new runs back, or null when it isn't.</summary>
    public DateTimeOffset? HeldUntil(DateTimeOffset now) =>
        agent.LastUserInputAt is { } at && at + HoldWindow > now ? at + HoldWindow : null;

    /// <summary>Returns the sleep before the next cycle, or null to go again right away.</summary>
    public async Task<TimeSpan?> RunAsync(PilotPairing pairing, CancellationToken ct)
    {
        // Never fight a user who launched the other provider by hand: pause instead of killing their session.
        var running = agent.RunningProvider;
        if (running is not null && running != pairing.Provider)
        {
            Conducting = false;
            await Task.Delay(OtherProviderPoll, time, ct);
            return null;
        }

        Conducting = true;

        // Only a cycle with work wakes the model.
        var taskList = await api.RefreshTasksAsync(ct);
        if (taskList is null)
        {
            return RefreshRetry;
        }

        var sleep = CycleSleep.Clamp(taskList.SleepSeconds);
        if (taskList.Tasks.Length == 0)
        {
            return await FinishEmptyAsync(sleep, ct);
        }

        // A run starts with /clear, which would wipe what the user is doing in the terminal.
        var now = time.GetUtcNow();
        if (HeldUntil(now) is { } until)
        {
            if (!holdReported)
            {
                await api.WriteJournalAsync(JournalLines.Hold, ct);
                holdReported = true;
            }

            return until - now;
        }

        holdReported = false;
        var task = taskList.Tasks[0];
        var runId = (await api.StartRunAsync(task.Id, taskList.Version, ct))?.Id;
        if (runId is null)
        {
            // A lost race or the duplicate-apply guard; the next refresh moves past it.
            return TimeSpan.FromSeconds(CycleSleep.MinSeconds);
        }

        if (running is null)
        {
            agent.Start(pairing);
            await Task.Delay(StartupGrace, time, ct);
        }

        await agent.SendCycleAsync(pairing, runId, ct);
        var result = await WaitForResultAsync(pairing, runId, ct);
        await TrackStreaksAsync(result, ct);
        return await RecordRunAsync(runId, sleep, result, ct);
    }

    private async Task<TimeSpan?> FinishEmptyAsync(int sleep, CancellationToken ct)
    {
        await api.RecordCycleAsync(sleep, ct);
        LastCycleAt = time.GetUtcNow();
        LastCycleStatus = CycleStatus.Empty;
        return TimeSpan.FromSeconds(sleep);
    }

    /// <summary>A run the agent never finished is cancelled here, so it does not hold its task.</summary>
    private async Task<TimeSpan?> RecordRunAsync(string runId, int sleep, WaitResult result, CancellationToken ct)
    {
        var posted = result.Kind is WaitKind.Finished;
        if (!posted)
        {
            await api.CancelRunAsync(runId, ct);
        }

        if (await agent.EndRunAsync(ct) is { } usage)
        {
            await api.ReportUsageAsync(runId, usage, ct);
        }

        await api.RecordCycleAsync(sleep, ct);
        var ok = posted && result.RunOutcome == "done";

        LastCycleAt = time.GetUtcNow();
        LastCycleStatus = ok ? CycleStatus.Ok : CycleStatus.Error;
        return posted ? TimeSpan.FromSeconds(sleep) : null;
    }

    /// <summary>Waits for the result; a stuck run climbs check-in, skip, then restart.</summary>
    private async Task<WaitResult> WaitForResultAsync(PilotPairing pairing, string runId, CancellationToken ct)
    {
        var wait = new RunWait();
        var result = await WaitAsync(runId, wait, ResultTimeout, ct);

        // No server check between rungs: every unfinished wait has just checked whether the run finished.
        (Directive Directive, string Report)[] rungs = [(Directive.CheckIn, JournalLines.CheckIn), (Directive.Skip, JournalLines.Skip)];
        foreach (var (directive, report) in rungs)
        {
            if (result.IsFinal)
            {
                return result;
            }

            await api.WriteJournalAsync(report, ct);
            await agent.SendDirectiveAsync(pairing, directive, ct);
            result = await WaitAsync(runId, wait, CheckInGrace, ct);
        }

        if (!result.IsFinal)
        {
            await api.WriteJournalAsync(JournalLines.Restart, ct);
            agent.Stop();
        }

        return result;
    }

    /// <summary>Backs off after a streak of restarts or exits, so a broken install or sign-in cannot hot-loop.</summary>
    private async Task TrackStreaksAsync(WaitResult result, CancellationToken ct)
    {
        if (result.Kind is WaitKind.Finished)
        {
            ConsecutiveRestarts = 0;
            ConsecutiveExits = 0;
        }
        else if (result.Kind is WaitKind.SessionExited)
        {
            if (++ConsecutiveExits >= BackoffThreshold)
            {
                ConsecutiveExits = 0;
                await api.WriteJournalAsync(JournalLines.ExitBackoff, ct);
                await Task.Delay(BackoffDelay, time, ct);
            }
        }
        else if (++ConsecutiveRestarts >= BackoffThreshold)
        {
            ConsecutiveRestarts = 0;
            await api.WriteJournalAsync(JournalLines.Backoff, ct);
            await Task.Delay(BackoffDelay, time, ct);
        }
    }

    /// <summary>Checks the server after each slice, since the run's event can be missed; fresh activity extends the wait.</summary>
    private async Task<WaitResult> WaitAsync(string runId, RunWait wait, TimeSpan quietBudget, CancellationToken ct)
    {
        var slice = checkInterval < quietBudget ? checkInterval : quietBudget;
        var quiet = TimeSpan.Zero;

        while (true)
        {
            var result = await agent.WaitForSignalAsync(slice, ct);
            if (result.IsFinal)
            {
                return result;
            }

            // A stuck signal returns the moment it fires; counting it as elapsed would let one noisy burst spend
            // the whole cycle budget in seconds.
            if (result.Kind is WaitKind.Timeout)
            {
                wait.Waited += slice;
                quiet += slice;
            }

            if (await api.GetRunAsync(runId, ct) is { FinishedAt: not null } run)
            {
                return WaitResult.Finished(run.Outcome ?? "failed");
            }

            var activity = await api.GetActivityAsync(ct);
            if (activity?.LastActivityAt is { } at && time.GetUtcNow() - at < RecentActivityWindow)
            {
                if (wait.Waited >= MaxCycleWait)
                {
                    return result;
                }

                if (wait.Waited >= ResultTimeout && !wait.ExtensionReported)
                {
                    await api.WriteJournalAsync(JournalLines.Extend, ct);
                    wait.ExtensionReported = true;
                }

                quiet = TimeSpan.Zero;
            }
            else if (quiet >= quietBudget || result.Kind is WaitKind.Stuck)
            {
                return result;
            }
        }
    }

    /// <summary>Shared by every wait of one run, so the cycle cap and the extension report count all of them.</summary>
    private sealed class RunWait
    {
        public TimeSpan Waited { get; set; }

        public bool ExtensionReported { get; set; }
    }
}

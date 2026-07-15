namespace JobPilot.Terminal.Pilot;

/// <summary>
/// The Pilot's per-cycle state machine: ensure a session, inject the skill, await its sentinel, and on a wedge
/// nudge then kill. Pure of timing and PTY details (both live behind <see cref="IPilotEnvironment"/>) so the
/// sentinel/nudge/kill ordering and backoff can be unit-tested.
/// </summary>
public sealed class PilotLoop(IPilotEnvironment env)
{
    public static readonly TimeSpan SentinelTimeout = TimeSpan.FromMinutes(20);
    public static readonly TimeSpan NudgeGrace = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan BackoffDelay = TimeSpan.FromMinutes(30);

    // Back off only after a broken install kills this many cycles in a row, so recovery does not hot-loop.
    public const int BackoffThreshold = 3;

    public const int MinSleepSeconds = 15;
    public const int MaxSleepSeconds = 21600;

    // Stable, user-facing intervention summaries pushed to the API journal (the phone hears about these).
    public const string NudgeReport = "Pilot watchdog: cycle timed out after 20m — nudged the agent.";
    public const string KillReport = "Pilot watchdog: agent unresponsive — restarted the session; the leased job will recover by TTL.";
    public const string BackoffReport = "Pilot watchdog: 3 consecutive stalls — backing off 30m.";

    private readonly IPilotEnvironment env = env;

    /// <summary>Consecutive watchdog kills; reset by any completed cycle.</summary>
    public int ConsecutiveTimeouts { get; private set; }

    public DateTimeOffset? LastCycleAt { get; private set; }

    public PilotCycleStatus? LastCycleStatus { get; private set; }

    /// <summary>False while paused on a user-driven provider mismatch.</summary>
    public bool Conducting { get; private set; }

    public static int ClampSleep(int seconds) => Math.Clamp(seconds, MinSleepSeconds, MaxSleepSeconds);

    /// <summary>Runs one cycle; the caller loops while pilot mode stays enabled.</summary>
    public async Task RunIterationAsync(PilotPairing pairing, CancellationToken ct)
    {
        // Never fight a user who manually launched the other provider: pause instead of killing their session.
        var running = env.RunningProvider;
        if (running is not null && running != pairing.Provider)
        {
            Conducting = false;
            await env.PauseAsync(ct);
            return;
        }

        Conducting = true;

        if (env.RunningProvider is null)
        {
            env.StartSession(pairing);
            await env.WaitStartupGraceAsync(ct);
        }

        await env.InjectCycleAsync(pairing, ct);

        var result = await env.AwaitSentinelAsync(SentinelTimeout, ct);
        if (await TrySleepOnCycleAsync(result, ct) || result.Outcome == PilotWaitOutcome.SessionExited)
        {
            return; // slept until the next cycle, or the session died and restarts next iteration
        }

        // Timed out: nudge exactly once, then a shorter grace.
        await ReportAsync(NudgeReport);
        await env.InjectNudgeAsync(pairing, ct);
        result = await env.AwaitSentinelAsync(NudgeGrace, ct);
        if (await TrySleepOnCycleAsync(result, ct) || result.Outcome == PilotWaitOutcome.SessionExited)
        {
            return;
        }

        // Still wedged: kill for a clean restart, and back off once repeated kills prove the install is broken.
        ConsecutiveTimeouts++;
        await ReportAsync(KillReport);
        env.StopSession();
        if (ConsecutiveTimeouts >= BackoffThreshold)
        {
            await ReportAsync(BackoffReport);
            await env.SleepAsync(BackoffDelay, ct);
        }
    }

    // Reporting is best-effort: the env swallows delivery errors, but guard here too so a future env
    // change can never wedge a cycle on a failed journal push.
    private async Task ReportAsync(string summary)
    {
        try
        {
            await env.ReportSystemAsync(summary);
        }
        catch
        {
        }
    }

    private async Task<bool> TrySleepOnCycleAsync(PilotWaitResult result, CancellationToken ct)
    {
        if (result.Outcome != PilotWaitOutcome.Sentinel)
        {
            return false;
        }

        ConsecutiveTimeouts = 0;
        LastCycleAt = DateTimeOffset.UtcNow;
        LastCycleStatus = result.Cycle.Status;
        await env.SleepAsync(TimeSpan.FromSeconds(ClampSleep(result.Cycle.SleepSeconds)), ct);
        return true;
    }
}

using System.Threading.Channels;
using JobPilot.Terminal.Pilot.Api;
using JobPilot.Terminal.Pilot.Stuck;
using JobPilot.Terminal.Pilot.Telemetry;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Sessions;

namespace JobPilot.Terminal.Pilot;

public sealed class PilotSession : IPilotSession, IDisposable
{
    private const string PilotSkill = "pilot";
    private const string ClearCommand = "/clear";
    private const int Cols = 220;
    private const int Rows = 50;
    private const int MaxSteerLength = 1000;
    private const string StopLine = "The user stopped this task. Do nothing more on it.";

    // Redraw time between /clear and the cycle command landing on the fresh prompt.
    private static readonly TimeSpan ClearSettle = TimeSpan.FromSeconds(2);

    // The CLIs export logs every second or so, so the last request's usage lands just after the cycle ends.
    private static readonly TimeSpan UsageFlush = TimeSpan.FromSeconds(3);

    private readonly TerminalSession terminal;
    private readonly PilotStore store;
    private readonly PilotApi api;
    private readonly UsageMeter usage;
    private readonly StepRecorder steps;
    private readonly ILogger<PilotSession> logger;
    private readonly StuckDetector stuck = new();

    // A finished run's outcome, or null for a stuck signal, so a wait sees whichever comes first. Not single-writer:
    // the PTY thread and the event listener both write, and a directive re-queues outcomes.
    private readonly Channel<string?> signals = Channel.CreateUnbounded<string?>(new UnboundedChannelOptions { SingleReader = true });

    private volatile string? currentRunId;

    public PilotSession(TerminalSession terminal, PilotStore store, PilotApi api, UsageMeter usage, StepRecorder steps, ILogger<PilotSession> logger)
    {
        this.terminal = terminal;
        this.store = store;
        this.api = api;
        this.usage = usage;
        this.steps = steps;
        this.logger = logger;
        terminal.Output += OnOutput;
    }

    public Provider? RunningProvider => terminal.IsRunning ? terminal.ActiveProvider : null;

    public DateTimeOffset? LastUserInputAt => terminal.LastUserInputAt;

    /// <summary>One line the user typed for the agent: no control characters, no newlines, capped.</summary>
    internal static string SanitizeSteer(string text)
    {
        var line = new string([.. text.Select(c => char.IsControl(c) ? ' ' : c)]).Trim();
        return line.Length > MaxSteerLength ? line[..MaxSteerLength] : line;
    }

    /// <summary>Stops the run in flight: aborts the turn, tells the agent why, and cancels the run.</summary>
    public async Task InterruptRunAsync(string runId, CancellationToken ct)
    {
        if (runId != currentRunId || store.Current is not { } settings)
        {
            return;
        }

        Interrupt();
        await SendAsync(StopLine, settings.Provider, ct);
        await api.CancelRunAsync(runId, ct);
    }

    /// <summary>Types the user's words into the run in flight, without stopping it.</summary>
    public async Task SteerRunAsync(string runId, string text, CancellationToken ct)
    {
        if (runId != currentRunId || store.Current is not { } settings || SanitizeSteer(text) is not { Length: > 0 } line)
        {
            return;
        }

        await SendAsync(line, settings.Provider, ct);
    }

    public void Start(PilotSettings settings) =>
        terminal.Start(settings.Provider, Cols, Rows, settings.Api);

    public async Task SendCycleAsync(PilotSettings settings, string runId, CancellationToken ct)
    {
        // Cycles keep their state in the API. Clearing first prevents mid-cycle auto-compaction and keeps
        // untrusted page content from lingering into the next cycle.
        await SendAsync(ClearCommand, settings.Provider, ct);
        await Task.Delay(ClearSettle, ct);

        while (signals.Reader.TryRead(out _))
        {
        }

        currentRunId = runId;
        stuck.Reset();
        usage.Start();
        steps.Start(runId);
        await SendAsync($"{settings.Provider.SkillCommand(PilotSkill)} {runId}", settings.Provider, ct);
    }

    public Task SendDirectiveAsync(PilotSettings settings, Directive directive, CancellationToken ct)
    {
        // A directive keeps the stuck run's context: no /clear, and a finish that raced in must survive.
        stuck.Reset();
        DropStuckSignals();
        var result = $"jobpilot-api POST /api/pilot/runs/{currentRunId}/result";
        var text = directive == Directive.CheckIn
            ? $"Checking in: you appear stuck. Finish now and post your result with {result} (outcome \"failed\" if you cannot finish)."
            : $"Stop the current action. Post a failed result now with {result}, saying where it stopped.";
        return SendAsync(text, settings.Provider, ct);
    }

    /// <summary>Only the handed-over run counts.</summary>
    public void OnRunFinished(string runId, string outcome)
    {
        if (runId == currentRunId)
        {
            signals.Writer.TryWrite(outcome);
        }
    }

    public async Task<WaitResult> WaitForSignalAsync(TimeSpan timeout, CancellationToken ct)
    {
        using var waitCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var exited = false;

        void OnExited(SessionExit _)
        {
            exited = true;
            waitCts.Cancel();
        }

        // Subscribe before checking IsRunning: an exit between the two would otherwise go unseen for the whole timeout.
        terminal.Exited += OnExited;
        try
        {
            if (!terminal.IsRunning)
            {
                return WaitResult.Exited;
            }

            waitCts.CancelAfter(timeout);
            var signal = await signals.Reader.ReadAsync(waitCts.Token);
            return signal is { } outcome ? WaitResult.Finished(outcome) : WaitResult.Stuck;
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return exited ? WaitResult.Exited : WaitResult.Timeout;
        }
        finally
        {
            terminal.Exited -= OnExited;
        }
    }

    public void Stop() => terminal.Stop();

    // Esc interrupts both provider TUIs and is harmless at an idle prompt.
    public void Interrupt()
    {
        if (terminal.IsRunning)
        {
            terminal.Write([0x1b]);
        }
    }

    public Task DelayAsync(TimeSpan duration, CancellationToken ct) => Task.Delay(duration, ct);

    public Task<PilotActivity?> GetActivityAsync(CancellationToken ct) => api.GetActivityAsync(ct);

    public Task ReportAsync(string summary, CancellationToken ct) => api.ReportAsync(summary, ct);

    public Task<PilotTaskList?> RefreshTasksAsync(CancellationToken ct) => api.RefreshTasksAsync(ct);

    public async Task<string?> StartRunAsync(string taskId, string taskListVersion, CancellationToken ct) =>
        (await api.StartRunAsync(taskId, taskListVersion, ct))?.Id;

    public Task<PilotRun?> GetRunAsync(string runId, CancellationToken ct) => api.GetRunAsync(runId, ct);

    public Task CancelRunAsync(string runId, CancellationToken ct) => api.CancelRunAsync(runId, ct);

    public async Task RecordCycleAsync(string? runId, int sleepSeconds, CancellationToken ct)
    {
        if (runId is not null)
        {
            // The run is over, so interrupts, steers and the stuck heuristic stop applying to it.
            currentRunId = null;
            steps.Stop();
            await Task.Delay(UsageFlush, ct);
            if (usage.Take() is { } measured)
            {
                await api.ReportUsageAsync(runId, measured, ct);
            }
        }

        await api.RecordCycleAsync(sleepSeconds, ct);
    }

    public void Dispose() => terminal.Output -= OnOutput;

    private async Task SendAsync(string command, Provider provider, CancellationToken ct)
    {
        var result = await terminal.SendCommandAsync(command, provider, ct);
        if (result != SendResult.Sent)
        {
            logger.LogWarning("Pilot command {Command} was not sent ({Result}).", command, result);
        }
    }

    private void OnOutput(byte[] data)
    {
        // Only a run in flight can be stuck; output between runs is the user's own session.
        if (currentRunId is null)
        {
            return;
        }

        if (stuck.Feed(data, DateTimeOffset.UtcNow) is var reason and not StuckReason.None)
        {
            logger.LogDebug("Pilot stuck heuristic fired ({Reason}).", reason);
            signals.Writer.TryWrite(null);
        }
    }

    // Stuck evidence left over from before a directive would end its grace at once, but a finish must survive.
    private void DropStuckSignals()
    {
        List<string> kept = [];
        while (signals.Reader.TryRead(out var signal))
        {
            if (signal is { } outcome)
            {
                kept.Add(outcome);
            }
        }

        foreach (var outcome in kept)
        {
            signals.Writer.TryWrite(outcome);
        }
    }
}

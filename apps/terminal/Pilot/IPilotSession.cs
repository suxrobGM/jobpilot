using JobPilot.Terminal.Providers;

namespace JobPilot.Terminal.Pilot;

public enum WaitOutcome
{
    Finished,
    Timeout,
    SessionExited,
    Stuck,
}

/// <summary><see cref="RunOutcome"/> is set only for <see cref="WaitOutcome.Finished"/>.</summary>
public readonly record struct WaitResult(WaitOutcome Outcome, string? RunOutcome = null)
{
    public static readonly WaitResult Timeout = new(WaitOutcome.Timeout);
    public static readonly WaitResult Exited = new(WaitOutcome.SessionExited);
    public static readonly WaitResult Stuck = new(WaitOutcome.Stuck);

    public static WaitResult Finished(string runOutcome) => new(WaitOutcome.Finished, runOutcome);

    /// <summary>The run has its result or lost its agent, so no directive can help.</summary>
    public bool Ended => Outcome is WaitOutcome.Finished or WaitOutcome.SessionExited;
}

/// <summary>CheckIn asks the agent to post its result; Skip makes it post a failed one.</summary>
public enum Directive
{
    CheckIn,
    Skip,
}

/// <summary>The loop's one seam to the terminal, the API, and the clock, so tests can script a whole cycle.</summary>
public interface IPilotSession
{
    /// <summary>Null when no session is running.</summary>
    Provider? RunningProvider { get; }

    /// <summary>When the user last typed into the terminal.</summary>
    DateTimeOffset? LastUserInputAt { get; }

    void Start(PilotSettings settings);

    /// <summary>Clears the agent's context and hands it the run.</summary>
    Task SendCycleAsync(PilotSettings settings, string runId, CancellationToken ct);

    Task SendDirectiveAsync(PilotSettings settings, Directive directive, CancellationToken ct);

    Task<WaitResult> WaitForSignalAsync(TimeSpan timeout, CancellationToken ct);

    void Stop();

    /// <summary>Aborts the agent's current turn but keeps the session.</summary>
    void Interrupt();

    Task DelayAsync(TimeSpan duration, CancellationToken ct);

    // The API calls below return null on failure and throw only on the caller's cancellation.
    Task<PilotActivity?> GetActivityAsync(CancellationToken ct);

    Task ReportAsync(string summary, CancellationToken ct);

    Task<PilotTaskList?> RefreshTasksAsync(CancellationToken ct);

    /// <summary>Null when the server refuses the start.</summary>
    Task<string?> StartRunAsync(string taskId, string taskListVersion, CancellationToken ct);

    Task<PilotRun?> GetRunAsync(string runId, CancellationToken ct);

    Task CancelRunAsync(string runId, CancellationToken ct);

    /// <summary>Ends a cycle: posts a run's measured token usage first, if the cycle had a run.</summary>
    Task RecordCycleAsync(string? runId, int sleepSeconds, CancellationToken ct);
}

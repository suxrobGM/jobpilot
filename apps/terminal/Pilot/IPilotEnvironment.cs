namespace JobPilot.Terminal.Pilot;

/// <summary>How an awaited cycle resolved.</summary>
public enum PilotWaitOutcome
{
    Sentinel,
    Timeout,
    SessionExited,

    /// <summary>A deterministic stall heuristic fired before the sentinel cap lapsed.</summary>
    StallDetected,
}

/// <summary>Result of awaiting a cycle sentinel.</summary>
public readonly record struct PilotWaitResult(PilotWaitOutcome Outcome, PilotCycle Cycle = default)
{
    public static readonly PilotWaitResult Timeout = new(PilotWaitOutcome.Timeout);
    public static readonly PilotWaitResult Exited = new(PilotWaitOutcome.SessionExited);
    public static readonly PilotWaitResult Stalled = new(PilotWaitOutcome.StallDetected);

    public static PilotWaitResult Sentinel(PilotCycle cycle) => new(PilotWaitOutcome.Sentinel, cycle);
}

/// <summary>Side effects the Pilot loop drives, abstracted from the real PTY so the state machine is testable.</summary>
public interface IPilotEnvironment
{
    /// <summary>Provider of the running session, or null when stopped.</summary>
    string? RunningProvider { get; }

    /// <summary>Starts the paired provider session.</summary>
    void StartSession(PilotPairing pairing);

    /// <summary>Waits for the freshly started CLI to become ready for input.</summary>
    Task WaitStartupGraceAsync(CancellationToken ct);

    /// <summary>Injects the pilot skill command.</summary>
    Task InjectCycleAsync(PilotPairing pairing, CancellationToken ct);

    /// <summary>Injects the one-shot unstick nudge.</summary>
    Task InjectNudgeAsync(PilotPairing pairing, CancellationToken ct);

    /// <summary>Injects the skip directive that forces the leased work failed after a nudge fails to unstick.</summary>
    Task InjectSkipAsync(PilotPairing pairing, CancellationToken ct);

    /// <summary>Waits for the next cycle sentinel, the timeout, or the session exiting.</summary>
    Task<PilotWaitResult> AwaitSentinelAsync(TimeSpan timeout, CancellationToken ct);

    /// <summary>Sleeps between cycles, honoring cancellation.</summary>
    Task SleepAsync(TimeSpan duration, CancellationToken ct);

    /// <summary>Stops the active session so the next iteration restarts it.</summary>
    void StopSession();

    /// <summary>Polls briefly while conducting is paused (user-driven provider mismatch).</summary>
    Task PauseAsync(CancellationToken ct);

    /// <summary>Reports a conductor intervention to the API journal. Best-effort; never throws.</summary>
    Task ReportSystemAsync(string summary);
}

namespace JobPilot.Terminal.Pilot;

public enum WaitKind
{
    Finished,
    Timeout,
    SessionExited,
    Stuck,
}

/// <summary><see cref="RunOutcome"/> is set only for <see cref="WaitKind.Finished"/>.</summary>
public readonly record struct WaitResult(WaitKind Kind, string? RunOutcome = null)
{
    public static readonly WaitResult Timeout = new(WaitKind.Timeout);
    public static readonly WaitResult Exited = new(WaitKind.SessionExited);
    public static readonly WaitResult Stuck = new(WaitKind.Stuck);

    public static WaitResult Finished(string runOutcome) => new(WaitKind.Finished, runOutcome);

    /// <summary>The run has its result or lost its agent, so no directive can help.</summary>
    public bool IsFinal => Kind is WaitKind.Finished or WaitKind.SessionExited;
}

/// <summary>CheckIn asks the agent to post its result; Skip makes it post a failed one.</summary>
public enum Directive
{
    CheckIn,
    Skip,
}

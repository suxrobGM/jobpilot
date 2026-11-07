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

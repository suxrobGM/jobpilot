namespace JobPilot.Terminal.Pilot;

public enum CycleStatus
{
    Ok,
    Empty,
    Error,
}

/// <summary>Journal entries the user's phone hears about, so keep the wording stable.</summary>
internal static class JournalLines
{
    public const string CheckIn = "Pilot orchestrator: the current run looks stuck - sent the agent a check-in reminder.";
    public const string Skip = "Pilot orchestrator: still stuck after the check-in - told the agent to set the task aside as failed and move on.";
    public const string Restart = "Pilot orchestrator: the agent stopped responding - restarted its session and cancelled the run.";
    public const string Backoff = "Pilot orchestrator: 3 runs in a row got stuck - taking a 30-minute break before trying again.";
    public const string ExitBackoff = "Pilot orchestrator: the provider CLI keeps exiting right after startup - check its install and sign-in - taking a 30-minute break.";
    public const string Hold = "Waiting while you use the terminal.";
    public const string Extend = "Pilot orchestrator: this run is taking longer than usual but is still making progress - giving it more time.";
    public const string Resume = "Pilot resumed after the app restarted.";
}

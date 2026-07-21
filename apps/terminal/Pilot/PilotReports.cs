namespace JobPilot.Terminal.Pilot;

/// <summary>
/// Stable, user-facing orchestrator summaries pushed to the API journal (the user's phone hears these). Kept in one
/// place because the exact wording is load-bearing and shared by the waiter and the intervention ladder.
/// </summary>
internal static class PilotReports
{
    public const string CheckIn = "Pilot orchestrator: the current run looks stuck - sent the agent a check-in reminder.";
    public const string Skip = "Pilot orchestrator: still stuck after the check-in - told the agent to set the task aside as failed and move on.";
    public const string Restart = "Pilot orchestrator: the agent stopped responding - restarted its session; the unfinished task will be picked up again automatically.";
    public const string Backoff = "Pilot orchestrator: 3 runs in a row got stuck - taking a 30-minute break before trying again.";
    public const string ExitBackoff =
        "Pilot orchestrator: the provider CLI keeps exiting right after startup - check its install and sign-in - taking a 30-minute break.";
    public const string Extend =
        "Pilot orchestrator: this run is taking longer than usual but is still making progress - giving it more time.";
    public const string Completion =
        "Pilot orchestrator: run completion confirmed via the server - the terminal output was garbled.";
}

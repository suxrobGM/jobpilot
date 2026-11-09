namespace JobPilot.Terminal.Pilot;

/// <summary>What the host tells the user in the pilot chat; each one also reaches their phone.</summary>
internal static class PilotMessages
{
    public const string Backoff =
        "My last 3 runs got stuck, so I'm taking a 30-minute break before I try again.";

    public const string ExitBackoff =
        "The agent on your computer keeps closing right after it starts. Check that Claude Code or Codex is installed and signed in. I'll try again in 30 minutes.";
}

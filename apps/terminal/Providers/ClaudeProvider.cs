namespace JobPilot.Terminal.Providers;

internal sealed class ClaudeProvider : Provider
{
    public override string Id => "claude";

    public override string DisplayName => "Claude Code";

    public override string Executable => "claude";

    public override string[] BuildArgs(string pluginDir, ILogger logger)
    {
        // Auto mode is a flag, not a settings key, so it holds even when the shipped file is missing.
        List<string> args = ["--permission-mode", "auto"];

        var settingsFile = Path.Combine(pluginDir, "settings", "claude.json");
        if (File.Exists(settingsFile))
        {
            args.AddRange(["--settings", settingsFile]);
        }
        else
        {
            logger.LogWarning(
                "Claude settings file missing at {Path}; the session starts without the shipped model, deny list, and auto-mode context.",
                settingsFile);
        }

        args.AddRange(["--plugin-dir", pluginDir]);
        return [.. args];
    }
}

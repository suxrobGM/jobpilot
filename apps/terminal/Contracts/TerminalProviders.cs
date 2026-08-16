using JobPilot.Terminal.Hosting;

namespace JobPilot.Terminal.Contracts;

/// <summary>Provider metadata returned to the web app.</summary>
/// <param name="Id">Stable provider id used by API requests.</param>
/// <param name="DisplayName">Label shown in the terminal UI.</param>
public sealed record TerminalProviderInfo(string Id, string DisplayName);

/// <summary>Provider launch command.</summary>
/// <param name="Provider">Provider metadata.</param>
/// <param name="Command">Executable to spawn.</param>
/// <param name="Args">Arguments passed to the executable.</param>
public sealed record TerminalLaunchSpec(TerminalProviderInfo Provider, string Command, string[] Args);

/// <summary>Registry of supported terminal providers.</summary>
public static class TerminalProviders
{
    public const string Claude = "claude";
    public const string Codex = "codex";

    private sealed record Definition(string Id, string DisplayName, string Command);

    private static readonly Definition[] All =
    [
        new(Claude, "Claude Code", "claude"),
        new(Codex, "Codex", "codex"),
    ];

    private static readonly TerminalProviderInfo[] SupportedProviders =
        [.. All.Select(p => new TerminalProviderInfo(p.Id, p.DisplayName))];

    /// <summary>Normalizes a provider id, defaulting to Claude.</summary>
    /// <exception cref="ArgumentException">The id is not a known provider.</exception>
    public static string Normalize(string? provider)
    {
        var trimmed = provider?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(trimmed))
        {
            return Claude;
        }

        return Find(trimmed).Id;
    }

    /// <summary>Returns a provider's display name.</summary>
    /// <exception cref="ArgumentException">The id is not a known provider.</exception>
    public static string GetDisplayName(string id) => Find(id).DisplayName;

    /// <summary>Formats a skill invocation for a provider (mirrors the web's formatSkillCommand).</summary>
    /// <exception cref="ArgumentException">The provider id is not a known provider.</exception>
    public static string FormatSkillCommand(string provider, string skill, string? args = null)
    {
        var command = Normalize(provider) == Codex ? $"${skill}" : $"/jobpilot:{skill}";
        var suffix = args?.Trim();
        return string.IsNullOrEmpty(suffix) ? command : $"{command} {suffix}";
    }

    /// <summary>Fresh-chat command (reset conversation context, same session); both provider TUIs accept it.</summary>
    public const string ClearCommand = "/clear";

    /// <summary>Returns every supported provider.</summary>
    public static TerminalProviderInfo[] Supported() => SupportedProviders;

    /// <summary>Builds a launch command for a normalized provider id, reading that provider's shipped settings from the plugin dir.</summary>
    /// <exception cref="ArgumentException">The provider id is not a known provider.</exception>
    public static TerminalLaunchSpec GetLaunchSpec(string provider, string pluginDir, string workingDir, ILogger logger)
    {
        var definition = Find(provider);
        var args = definition.Id == Codex
            ? CodexArgs(pluginDir, workingDir, logger)
            : ClaudeArgs(pluginDir, logger);
        return new TerminalLaunchSpec(
            new TerminalProviderInfo(definition.Id, definition.DisplayName), definition.Command, args);
    }

    // Auto mode keeps the session unattended while a classifier reviews each action.
    // It is a flag rather than a settings-file key so it holds even when the shipped file is missing.
    private static string[] ClaudeArgs(string pluginDir, ILogger logger)
    {
        List<string> args = ["--permission-mode", "auto"];
        if (AgentSettings.ClaudeSettingsFile(pluginDir, logger) is { } settingsFile)
        {
            args.Add("--settings");
            args.Add(settingsFile);
        }

        args.Add("--plugin-dir");
        args.Add(pluginDir);
        return [.. args];
    }

    // Codex has no --settings flag, so shipped config arrives as repeated -c overrides.
    private static string[] CodexArgs(string pluginDir, string workingDir, ILogger logger)
    {
        List<string> args = ["--no-alt-screen", "-C", workingDir, "--approve-for-me"];
        foreach (var configOverride in AgentSettings.CodexConfigOverrides(pluginDir, logger))
        {
            args.Add("-c");
            args.Add(configOverride);
        }

        return [.. args];
    }

    private static Definition Find(string id)
    {
        foreach (var definition in All)
        {
            if (definition.Id == id)
            {
                return definition;
            }
        }

        throw new ArgumentException($"Unsupported terminal provider '{id}'.");
    }
}

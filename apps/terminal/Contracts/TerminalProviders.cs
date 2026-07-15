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

    private sealed record Definition(
        string Id,
        string DisplayName,
        string Command,
        Func<string, string, string[]> BuildArgs);

    private static readonly Definition[] All =
    [
        new(Claude, "Claude Code", "claude",
            (pluginDir, _) => ["--dangerously-skip-permissions", "--plugin-dir", pluginDir]),
        new(Codex, "Codex", "codex",
            (_, workingDir) => ["--no-alt-screen", "-C", workingDir]),
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
        var command = Find(Normalize(provider)).Id == Codex ? $"${skill}" : $"/jobpilot:{skill}";
        var suffix = args?.Trim();
        return string.IsNullOrEmpty(suffix) ? command : $"{command} {suffix}";
    }

    /// <summary>Returns every supported provider.</summary>
    public static TerminalProviderInfo[] Supported() => SupportedProviders;

    /// <summary>Builds a launch command for a normalized provider id.</summary>
    /// <exception cref="ArgumentException">The provider id is not a known provider.</exception>
    public static TerminalLaunchSpec GetLaunchSpec(string provider, string pluginDir, string workingDir)
    {
        var definition = Find(provider);
        return new TerminalLaunchSpec(
            new TerminalProviderInfo(definition.Id, definition.DisplayName),
            definition.Command,
            definition.BuildArgs(pluginDir, workingDir));
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

using JobPilot.Terminal.Models;

namespace JobPilot.Terminal;

/// <summary>
/// Command and argument details used to launch a provider process.
/// </summary>
/// <param name="Provider">Provider metadata.</param>
/// <param name="Command">Executable to spawn.</param>
/// <param name="Args">Arguments passed to the executable.</param>
public sealed record TerminalLaunchSpec(TerminalProviderInfo Provider, string Command, string[] Args);

/// <summary>
/// Resolved filesystem paths used to launch embedded AI terminal sessions.
/// </summary>
public sealed record TerminalSessionPaths(
    string WorkingDir,
    string SharedSkillsDir,
    string ClaudePluginDir,
    string CodexPluginDir)
{
    /// <summary>
    /// Finds the JobPilot repository/plugin layout from the current process location.
    /// </summary>
    public static TerminalSessionPaths Resolve()
    {
        var roots = CandidateRoots().Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

        // Both providers load from a single plugin/ directory holding the
        // .claude-plugin/ and .codex-plugin/ manifests, the shared skills/ tree,
        // and .mcp.json. The same layout is used in dev (repo root) and in the
        // published output root.
        foreach (var root in roots)
        {
            var pluginDir = Path.Combine(root, "plugin");
            var skillsDir = Path.Combine(pluginDir, "skills");

            if (IsSharedSkillsDir(skillsDir)
                && IsClaudePluginDir(pluginDir)
                && IsCodexPluginDir(pluginDir))
            {
                return new TerminalSessionPaths(root, skillsDir, pluginDir, pluginDir);
            }
        }

        throw new DirectoryNotFoundException(
            "Could not find JobPilot provider assets: a plugin/ directory with skills/, .claude-plugin/, and .codex-plugin/.");
    }

    /// <summary>
    /// Resolves an optional client-provided working directory against this session's default.
    /// </summary>
    public string ResolveWorkingDir(string? requestedWorkingDir)
    {
        return string.IsNullOrWhiteSpace(requestedWorkingDir)
            ? WorkingDir
            : Path.GetFullPath(requestedWorkingDir);
    }

    /// <summary>
    /// Builds the launch command for a provider.
    /// </summary>
    public TerminalLaunchSpec GetLaunchSpec(string? provider, string workingDir)
    {
        var normalized = TerminalProviders.Normalize(provider);
        var info = new TerminalProviderInfo(normalized, TerminalProviders.GetDisplayName(normalized));
        return normalized switch
        {
            TerminalProviders.Claude => new TerminalLaunchSpec(info, "claude", ["--dangerously-skip-permissions", "--plugin-dir", ClaudePluginDir]),
            TerminalProviders.Codex => new TerminalLaunchSpec(info, "codex", ["--no-alt-screen", "-C", workingDir]),
            _ => throw new ArgumentOutOfRangeException(nameof(provider), provider, null)
        };
    }

    /// <summary>
    /// Returns every supported provider for UI discovery.
    /// </summary>
    public static TerminalProviderInfo[] Providers()
    {
        return
        [
            new TerminalProviderInfo(TerminalProviders.Claude, TerminalProviders.GetDisplayName(TerminalProviders.Claude)),
            new TerminalProviderInfo(TerminalProviders.Codex, TerminalProviders.GetDisplayName(TerminalProviders.Codex))
        ];
    }

    private static IEnumerable<string> CandidateRoots()
    {
        foreach (var root in Ancestors(Environment.CurrentDirectory))
        {
            yield return root;
        }

        foreach (var root in Ancestors(AppContext.BaseDirectory))
        {
            yield return root;
        }
    }

    private static bool IsSharedSkillsDir(string path)
    {
        // Single tree: shared/ docs + one dir per skill (e.g. auto-apply/SKILL.md).
        return File.Exists(Path.Combine(path, "shared", "setup.md"))
            && File.Exists(Path.Combine(path, "auto-apply", "SKILL.md"));
    }

    private static bool IsClaudePluginDir(string path)
    {
        return File.Exists(Path.Combine(path, ".claude-plugin", "plugin.json"));
    }

    private static bool IsCodexPluginDir(string path)
    {
        return File.Exists(Path.Combine(path, ".codex-plugin", "plugin.json"));
    }

    private static IEnumerable<string> Ancestors(string path)
    {
        var directory = new DirectoryInfo(Path.GetFullPath(path));
        while (directory is not null)
        {
            yield return directory.FullName;
            directory = directory.Parent;
        }
    }
}

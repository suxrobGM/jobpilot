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

        foreach (var root in roots)
        {
            var sourceSharedSkillsDir = Path.Combine(root, "src", "jobpilot-skills");
            var sourceClaudePluginDir = Path.Combine(root, "src", "jobpilot-claude-plugin");
            var sourceCodexPluginDir = Path.Combine(root, "src", "jobpilot-codex-plugin");

            if (IsSharedSkillsDir(sourceSharedSkillsDir)
                && IsClaudePluginDir(sourceClaudePluginDir)
                && IsCodexPluginDir(sourceCodexPluginDir))
            {
                return new TerminalSessionPaths(
                    root,
                    sourceSharedSkillsDir,
                    sourceClaudePluginDir,
                    sourceCodexPluginDir);
            }

            var publishedSharedSkillsDir = Path.Combine(root, "jobpilot-skills");
            var publishedClaudePluginDir = Path.Combine(root, "jobpilot-claude-plugin");
            var publishedCodexPluginDir = Path.Combine(root, "jobpilot-codex-plugin");

            if (IsSharedSkillsDir(publishedSharedSkillsDir)
                && IsClaudePluginDir(publishedClaudePluginDir)
                && IsCodexPluginDir(publishedCodexPluginDir))
            {
                return new TerminalSessionPaths(
                    root,
                    publishedSharedSkillsDir,
                    publishedClaudePluginDir,
                    publishedCodexPluginDir);
            }
        }

        throw new DirectoryNotFoundException(
            "Could not find JobPilot provider assets: jobpilot-skills, jobpilot-claude-plugin, and jobpilot-codex-plugin.");
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
        return normalized switch
        {
            TerminalProviders.Claude => new TerminalLaunchSpec(
                new TerminalProviderInfo(TerminalProviders.Claude, "Claude Code"),
                "claude",
                ["--plugin-dir", ClaudePluginDir]),
            TerminalProviders.Codex => new TerminalLaunchSpec(
                new TerminalProviderInfo(TerminalProviders.Codex, "Codex"),
                "codex",
                ["--no-alt-screen", "-C", workingDir]),
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
            new TerminalProviderInfo(TerminalProviders.Claude, "Claude Code"),
            new TerminalProviderInfo(TerminalProviders.Codex, "Codex")
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
        return File.Exists(Path.Combine(path, "shared", "setup.md"))
            && File.Exists(Path.Combine(path, "skills", "autopilot.md"));
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

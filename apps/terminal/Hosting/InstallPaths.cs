namespace JobPilot.Terminal.Hosting;

/// <summary>Resolved filesystem paths of a JobPilot install.</summary>
public sealed record InstallPaths
{
    /// <summary>Default working directory for a launched session.</summary>
    public required string WorkingDir { get; init; }

    /// <summary>Bundled plugin dir Claude loads and JobPilot workers use; Codex loads its user-installed public copy.</summary>
    public required string PluginDir { get; init; }

    /// <summary>Skills tree used as the JOBPILOT_SKILLS_ROOT anchor; shared docs live under its _shared/.</summary>
    public string SkillsDir => SkillsDirOf(PluginDir);

    /// <summary>Finds the repository or published plugin layout.</summary>
    public static InstallPaths Resolve()
    {
        return ResolveFrom(CandidateRoots());
    }

    /// <summary>Returns the first candidate containing a valid plugin layout.</summary>
    internal static InstallPaths ResolveFrom(IEnumerable<string> candidateRoots)
    {
        var roots = candidateRoots.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

        foreach (var root in roots)
        {
            if (IsInstallRoot(root))
            {
                return new InstallPaths
                {
                    WorkingDir = root,
                    PluginDir = Path.Combine(root, "plugin"),
                };
            }
        }

        throw new DirectoryNotFoundException(
            "Could not find JobPilot provider assets: a plugin/ directory with skills/, skills/_shared/, .claude-plugin/, and .codex-plugin/.");
    }

    /// <summary>Whether a directory holds a complete plugin tree.</summary>
    public static bool IsInstallRoot(string root)
    {
        var pluginDir = Path.Combine(root, "plugin");
        return HasRuntimeResources(pluginDir)
            && IsClaudePluginDir(pluginDir)
            && IsCodexPluginDir(pluginDir);
    }

    private static string SkillsDirOf(string pluginDir) => Path.Combine(pluginDir, "skills");

    private static IEnumerable<string> CandidateRoots() =>
        CandidateRoots(AppContext.BaseDirectory, Environment.CurrentDirectory);

    /// <summary>Orders executable-relative roots before launch-directory fallbacks.</summary>
    internal static IEnumerable<string> CandidateRoots(string baseDirectory, string currentDirectory)
    {
        foreach (var root in Ancestors(baseDirectory))
        {
            yield return root;
        }

        foreach (var root in Ancestors(currentDirectory))
        {
            yield return root;
        }
    }

    private static bool HasRuntimeResources(string pluginDir)
    {
        var skillsDir = SkillsDirOf(pluginDir);
        return File.Exists(Path.Combine(skillsDir, "_shared", "setup.md"))
            && File.Exists(Path.Combine(skillsDir, "auto-apply", "SKILL.md"));
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

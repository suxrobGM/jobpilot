namespace JobPilot.Terminal.Hosting;

/// <summary>The host's install layout, resolved once. A missing plugin tree degrades the host instead of stopping it.</summary>
public sealed class HostInstall
{
    public HostInstall(ILogger<HostInstall> logger)
    {
        try
        {
            Paths = InstallPaths.Resolve();
        }
        catch (Exception ex)
        {
            PathsError = ex.Message;
            logger.LogError(ex, "Terminal host install is incomplete; sessions cannot start.");
        }

        CanUpdate = Paths is not null && IsPublishedHost;
    }

    internal HostInstall(InstallPaths? paths, string? pathsError = null, bool canUpdate = false)
    {
        Paths = paths;
        PathsError = pathsError;
        CanUpdate = canUpdate;
    }

    public static string HostVersion { get; } = typeof(HostInstall).Assembly.GetName().Version?.ToString(3) ?? "0.0.0";

    /// <summary>
    /// Whether the executable ships its own plugin tree: a published install, as opposed to a build output that
    /// finds the repo's tree in an ancestor directory.
    /// </summary>
    public static bool IsPublishedHost { get; } = InstallPaths.IsInstallRoot(AppContext.BaseDirectory);

    /// <summary>Null when the plugin tree could not be found; <see cref="PathsError"/> says why.</summary>
    public InstallPaths? Paths { get; }

    public string? PathsError { get; }

    public bool CanUpdate { get; }

    public InstallPaths RequirePaths() => Paths ?? throw new InvalidOperationException(
        $"Terminal host install is incomplete - reinstall the JobPilot agent. ({PathsError})");
}

public sealed record InstallPaths
{
    /// <summary>The install root, which is also every session's working directory.</summary>
    public required string WorkingDir { get; init; }

    public required string PluginDir { get; init; }

    /// <summary>JOBPILOT_SKILLS_ROOT; shared docs live under its _shared/.</summary>
    public string SkillsDir => Path.Combine(PluginDir, "skills");

    /// <summary>Plugin commands such as jobpilot-api, first on the session's PATH.</summary>
    public string BinDir => Path.Combine(PluginDir, "bin");

    /// <summary>JOBPILOT_TEMP: skill scratch files, swept by ScratchCleaner.</summary>
    public string ScratchDir => Path.Combine(WorkingDir, ".temp");

    /// <summary>One browser profile per Playwright MCP server in plugin/.mcp.json.</summary>
    public IReadOnlyList<string> PlaywrightDirs =>
        [
            Path.Combine(WorkingDir, ".playwright-mcp"),
            Path.Combine(WorkingDir, ".playwright-mcp-2"),
            Path.Combine(WorkingDir, ".playwright-mcp-3"),
        ];

    public static InstallPaths Resolve() =>
        ResolveFrom(CandidateRoots(AppContext.BaseDirectory, Environment.CurrentDirectory));

    internal static InstallPaths ResolveFrom(IEnumerable<string> candidateRoots)
    {
        var root = candidateRoots.Distinct(StringComparer.OrdinalIgnoreCase).FirstOrDefault(IsInstallRoot)
            ?? throw new DirectoryNotFoundException(
                "Could not find JobPilot provider assets: a plugin/ directory with skills/, skills/_shared/, .mcp.json, .claude-plugin/, and .codex-plugin/.");
        return new InstallPaths { WorkingDir = root, PluginDir = Path.Combine(root, "plugin") };
    }

    public static bool IsInstallRoot(string root)
    {
        var plugin = Path.Combine(root, "plugin");
        string[] required =
        [
            Path.Combine("skills", "_shared", "setup.md"),
            Path.Combine("skills", "auto-apply", "SKILL.md"),
            ".mcp.json",
            Path.Combine(".claude-plugin", "plugin.json"),
            Path.Combine(".codex-plugin", "plugin.json"),
        ];
        return required.All(file => File.Exists(Path.Combine(plugin, file)));
    }

    /// <summary>Ancestors of the executable first, then of the launch directory.</summary>
    internal static IEnumerable<string> CandidateRoots(string baseDirectory, string currentDirectory) =>
        Ancestors(baseDirectory).Concat(Ancestors(currentDirectory));

    private static IEnumerable<string> Ancestors(string path)
    {
        for (var dir = new DirectoryInfo(Path.GetFullPath(path)); dir is not null; dir = dir.Parent)
        {
            yield return dir.FullName;
        }
    }
}

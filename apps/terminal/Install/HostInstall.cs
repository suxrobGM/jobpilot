namespace JobPilot.Terminal.Install;

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

    internal HostInstall(InstallPaths? paths, string? pathsError = null)
    {
        Paths = paths;
        PathsError = pathsError;
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

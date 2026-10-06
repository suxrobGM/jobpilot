using JobPilot.Terminal.Common;
using JobPilot.Terminal.Hosting;
using Microsoft.Extensions.Hosting;

namespace JobPilot.Terminal.Sessions;

/// <summary>Cleans .temp and every .playwright-mcp* profile's scratch at session start and every few hours.</summary>
public sealed class ScratchCleaner(HostInstall install, ILogger<ScratchCleaner> logger) : BackgroundService
{
    public static readonly TimeSpan Retention = TimeSpan.FromHours(24);

    private static readonly TimeSpan SweepInterval = TimeSpan.FromHours(6);

    // Lets Kestrel finish binding before the first sweep touches the disk.
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(1);

    private static readonly string[] PlaywrightScratchExtensions =
        [".log", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".md", ".json", ".yml", ".yaml"];

    /// <summary>Removes every Playwright scratch file plus aged .temp files.</summary>
    public void CleanSessionStart(InstallPaths paths)
    {
        CleanPlaywright(paths, maxAge: null);
        CleanTemp(paths);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(StartupDelay, stoppingToken);
            using var timer = new PeriodicTimer(SweepInterval);
            do
            {
                // A degraded host (no plugin tree) has no workspace to clean. The playwright sweep is
                // age-gated so it can't yank a file the live browser session just wrote.
                if (install.Paths is { } paths)
                {
                    CleanTemp(paths);
                    CleanPlaywright(paths, Retention);
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException)
        {
        }
    }

    // The whole .temp tree is scratch, so it has no extension allowlist.
    internal void CleanTemp(InstallPaths paths)
    {
        var dir = paths.ScratchDir;
        DeleteFiles(dir, SearchOption.AllDirectories, extensions: null, DateTime.UtcNow - Retention);
        FileTree.DeleteEmptyDirectories(dir);
    }

    // Top level only: browser profiles live in subdirectories. A null maxAge ignores age.
    internal void CleanPlaywright(InstallPaths paths, TimeSpan? maxAge)
    {
        DateTime? cutoff = maxAge is { } age ? DateTime.UtcNow - age : null;
        foreach (var dir in paths.PlaywrightDirs)
        {
            DeleteFiles(dir, SearchOption.TopDirectoryOnly, PlaywrightScratchExtensions, cutoff);
        }
    }

    private void DeleteFiles(string dir, SearchOption depth, string[]? extensions, DateTime? cutoff)
    {
        if (!Directory.Exists(dir))
        {
            return;
        }

        var removed = 0;
        foreach (var file in Directory.EnumerateFiles(dir, "*", depth))
        {
            if (extensions is not null
                && !extensions.Contains(Path.GetExtension(file), StringComparer.OrdinalIgnoreCase))
            {
                continue;
            }

            try
            {
                if (cutoff is { } c && File.GetLastWriteTimeUtc(file) > c)
                {
                    continue;
                }

                File.Delete(file);
                removed++;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                // A locked or in-use file is picked up by a later sweep.
            }
        }

        if (removed > 0)
        {
            logger.LogInformation("Cleaned {Count} scratch file(s) from {Dir}.", removed, dir);
        }
    }
}

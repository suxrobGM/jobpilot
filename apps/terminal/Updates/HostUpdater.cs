using JobPilot.Terminal.Install;

namespace JobPilot.Terminal.Updates;

/// <summary>
/// Replaces the installed host with the newest GitHub release: at startup before binding, or on request from the
/// dashboard.
/// </summary>
public sealed class HostUpdater(ReleaseFeed releases, InstallSwap swap, HostInstall install, ILogger<HostUpdater> logger)
{
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(20);

    private int updateInProgress;

    /// <summary>Runs before the host binds. Returns true when a replacement was launched and this process should exit.</summary>
    public async Task<bool> UpdateAtStartupAsync()
    {
        if (HostHandoff.IsUpdateRelaunch)
        {
            return false;
        }

        if (!install.CanUpdate)
        {
            logger.LogInformation("Not a published install (dev checkout); skipping auto-update.");
            return false;
        }

        try
        {
            using var timeout = new CancellationTokenSource(StartupTimeout);
            var result = await UpdateAsync(timeout.Token);
            if (result.Updating)
            {
                logger.LogInformation("Host updated to v{Next}; relaunching.", result.ToVersion);
            }

            return result.Updating;
        }
        catch (Exception ex)
        {
            logger.LogInformation(ex, "Auto-update skipped; keeping the current install.");
            return false;
        }
    }

    /// <summary>Updates a running host. On success the caller stops this process so the replacement can bind.</summary>
    public async Task<UpdateResult> UpdateNowAsync(CancellationToken ct)
    {
        if (!install.CanUpdate)
        {
            return NotUpdating(UpdateResult.ReasonDevCheckout);
        }

        if (Interlocked.Exchange(ref updateInProgress, 1) == 1)
        {
            return NotUpdating(UpdateResult.ReasonInProgress);
        }

        var updating = false;
        try
        {
            var result = await UpdateAsync(ct);
            updating = result.Updating;
            return result;
        }
        finally
        {
            // A successful update never re-arms: this process is shutting down and must not start a second swap.
            if (!updating)
            {
                Volatile.Write(ref updateInProgress, 0);
            }
        }
    }

    private async Task<UpdateResult> UpdateAsync(CancellationToken ct)
    {
        var exePath = Environment.ProcessPath ?? throw new InvalidOperationException("Cannot resolve the host executable path.");
        DeleteOldExecutable(exePath);

        var published = await releases.FetchAsync(ct);
        var current = Version.Parse(HostInstall.HostVersion);
        if (ReleaseFeed.FindNewer(published, current) is not { } newer)
        {
            logger.LogInformation("Host is up to date (v{Current}).", HostInstall.HostVersion);
            return NotUpdating(UpdateResult.ReasonUpToDate);
        }

        var assetName = ReleaseFeed.AssetName();
        var asset = newer.Release.Assets?.FirstOrDefault(a => a.Name == assetName);
        if (asset?.DownloadUrl is not { } downloadUrl)
        {
            logger.LogInformation("Host release {Tag} has no {Asset} asset; skipping.", newer.Release.TagName, assetName);
            return NotUpdating(UpdateResult.ReasonNoAsset);
        }

        logger.LogInformation("Updating host v{Current} -> v{Next}.", HostInstall.HostVersion, newer.Version);
        await swap.RunAsync(downloadUrl, exePath, ct);
        HostHandoff.Relaunch(exePath);

        return new UpdateResult
        {
            Updating = true,
            FromVersion = HostInstall.HostVersion,
            ToVersion = newer.Version.ToString(3),
        };
    }

    private void DeleteOldExecutable(string exePath)
    {
        try
        {
            File.Delete(exePath + ".old");
        }
        catch (Exception ex)
        {
            logger.LogInformation(ex, "Could not remove the previous host binary; the next startup retries.");
        }
    }

    private static UpdateResult NotUpdating(string reason) =>
        new() { Updating = false, FromVersion = HostInstall.HostVersion, Reason = reason };
}

using System.Formats.Tar;
using System.IO.Compression;
using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Text.Json.Serialization;
using JobPilot.Terminal.Common;
using JobPilot.Terminal.Hosting;

namespace JobPilot.Terminal.Updates;

public sealed record GitHubRelease(
    [property: JsonPropertyName("tag_name")] string? TagName,
    [property: JsonPropertyName("assets")] GitHubAsset[]? Assets);

public sealed record GitHubAsset(
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("browser_download_url")] string? DownloadUrl);

/// <summary>
/// Replaces the installed host with the newest GitHub release: at startup before binding, or on request from the
/// dashboard. The updater owns the executable and the plugin/ tree; the rest of the install root may be user state.
/// </summary>
public sealed class HostUpdater(HttpClient http, HostInstall install, ILogger<HostUpdater> logger)
{
    private const string ReleasesUrl = "https://api.github.com/repos/suxrobGM/jobpilot/releases?per_page=30";
    private const string TagPrefix = "v";

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

    /// <summary>The highest <c>vX.Y.Z</c> release newer than <paramref name="current"/>, if any.</summary>
    internal static (GitHubRelease Release, Version Version)? FindNewerRelease(IEnumerable<GitHubRelease> releases, Version current)
    {
        (GitHubRelease Release, Version Version)? best = null;
        foreach (var release in releases)
        {
            if (release.TagName is not { } tag
                || !tag.StartsWith(TagPrefix, StringComparison.Ordinal)
                || !Version.TryParse(tag[TagPrefix.Length..], out var version))
            {
                continue;
            }

            if (version > current && (best is null || version > best.Value.Version))
            {
                best = (release, version);
            }
        }

        return best;
    }

    internal static bool IsValidHost(string dir, string exeName) =>
        File.Exists(Path.Combine(dir, exeName))
        && InstallPaths.IsInstallRoot(dir);

    /// <summary>Deletes plugin files the new release no longer ships. Only plugin/: the rest of the install root may be user state.</summary>
    internal static void PruneRemovedPluginFiles(string stagingDir, string installDir)
    {
        var stagedPlugin = Path.Combine(stagingDir, "plugin");
        var installedPlugin = Path.Combine(installDir, "plugin");
        if (!Directory.Exists(stagedPlugin) || !Directory.Exists(installedPlugin))
        {
            return;
        }

        foreach (var file in Directory.GetFiles(installedPlugin, "*", SearchOption.AllDirectories))
        {
            if (!File.Exists(Path.Combine(stagedPlugin, Path.GetRelativePath(installedPlugin, file))))
            {
                File.Delete(file);
            }
        }

        FileTree.DeleteEmptyDirectories(installedPlugin);
    }

    private async Task<UpdateResult> UpdateAsync(CancellationToken ct)
    {
        var exePath = Environment.ProcessPath ?? throw new InvalidOperationException("Cannot resolve the host executable path.");
        DeleteOldExecutable(exePath);

        var releases = await FetchReleasesAsync(ct);
        var current = Version.Parse(HostInstall.HostVersion);
        if (FindNewerRelease(releases, current) is not { } newer)
        {
            logger.LogInformation("Host is up to date (v{Current}).", HostInstall.HostVersion);
            return NotUpdating(UpdateResult.ReasonUpToDate);
        }

        var assetName = $"jobpilot-terminal-{RuntimeId()}{(OperatingSystem.IsWindows() ? ".zip" : ".tar.gz")}";
        var asset = newer.Release.Assets?.FirstOrDefault(a => a.Name == assetName);
        if (asset?.DownloadUrl is not { } downloadUrl)
        {
            logger.LogInformation("Host release {Tag} has no {Asset} asset; skipping.", newer.Release.TagName, assetName);
            return NotUpdating(UpdateResult.ReasonNoAsset);
        }

        logger.LogInformation("Updating host v{Current} -> v{Next}.", HostInstall.HostVersion, newer.Version);
        await SwapAsync(downloadUrl, exePath, ct);
        HostHandoff.Relaunch(exePath);

        return new UpdateResult
        {
            Updating = true,
            FromVersion = HostInstall.HostVersion,
            ToVersion = newer.Version.ToString(3),
        };
    }

    private async Task<GitHubRelease[]> FetchReleasesAsync(CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, ReleasesUrl);
        request.Headers.UserAgent.Add(new ProductInfoHeaderValue("jobpilot-terminal", HostInstall.HostVersion));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        using var response = await http.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync(AppJsonContext.Default.GitHubReleaseArray, ct)
            ?? throw new InvalidOperationException("Could not read the GitHub releases list.");
    }

    /// <summary>
    /// Downloads and validates the release, moves the running executable aside, and copies the release over the
    /// install. The executable is restored if copying fails; other files heal on the next update.
    /// </summary>
    private async Task SwapAsync(string url, string exePath, CancellationToken ct)
    {
        var installDir = Path.GetDirectoryName(exePath)!;
        var staging = Path.TrimEndingDirectorySeparator(installDir) + ".new";
        FileTree.DeleteIfExists(staging);
        Directory.CreateDirectory(staging);
        try
        {
            await DownloadAndExtractAsync(url, staging, ct);
            if (!IsValidHost(staging, Path.GetFileName(exePath)))
            {
                throw new InvalidOperationException("Downloaded host failed validation; keeping the current binary.");
            }

            var oldExe = exePath + ".old";
            File.Delete(oldExe);
            File.Move(exePath, oldExe);
            try
            {
                FileTree.Copy(staging, installDir);
                PruneRemovedPluginFiles(staging, installDir);
            }
            catch
            {
                File.Move(oldExe, exePath, overwrite: true);
                throw;
            }

            // Windows keeps the running image locked; the next startup deletes it.
            if (!OperatingSystem.IsWindows())
            {
                File.Delete(oldExe);
            }
        }
        finally
        {
            FileTree.DeleteIfExists(staging);
        }
    }

    private async Task DownloadAndExtractAsync(string url, string destination, CancellationToken ct)
    {
        var archive = Path.GetTempFileName();
        try
        {
            await using (var download = await http.GetStreamAsync(url, ct))
            await using (var file = File.Create(archive))
            {
                await download.CopyToAsync(file, ct);
            }

            if (url.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
            {
                ZipFile.ExtractToDirectory(archive, destination, overwriteFiles: true);
            }
            else
            {
                await using var file = File.OpenRead(archive);
                await using var gzip = new GZipStream(file, CompressionMode.Decompress);
                await TarFile.ExtractToDirectoryAsync(gzip, destination, overwriteFiles: true, ct);
            }
        }
        finally
        {
            File.Delete(archive);
        }
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

    private static string RuntimeId()
    {
        var os = "linux";
        if (OperatingSystem.IsWindows())
        {
            os = "win";
        }
        else if (OperatingSystem.IsMacOS())
        {
            os = "osx";
        }

        var arch = RuntimeInformation.OSArchitecture switch
        {
            Architecture.X64 => "x64",
            Architecture.Arm64 => "arm64",
            _ => throw new PlatformNotSupportedException($"Unsupported architecture: {RuntimeInformation.OSArchitecture}"),
        };
        return $"{os}-{arch}";
    }
}

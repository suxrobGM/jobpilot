using System.Formats.Tar;
using System.IO.Compression;
using JobPilot.Terminal.Common;

namespace JobPilot.Terminal.Install.Updates;

/// <summary>
/// Copies a downloaded release over the install. Owns the executable and plugin/ only: the rest of
/// the install root may be user state.
/// </summary>
public sealed class InstallSwap(HttpClient http)
{
    /// <summary>
    /// Downloads and validates the release, moves the running executable aside, and copies the release over the
    /// install. The executable is restored if copying fails; other files heal on the next update.
    /// </summary>
    public async Task RunAsync(string url, string exePath, CancellationToken ct)
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

    internal static bool IsValidHost(string dir, string exeName) =>
        File.Exists(Path.Combine(dir, exeName))
        && InstallPaths.IsInstallRoot(dir);

    /// <summary>Deletes plugin files the new release no longer ships.</summary>
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
}

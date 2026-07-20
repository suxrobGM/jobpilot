using System.Diagnostics;
using System.Formats.Tar;
using System.Globalization;
using System.IO.Compression;

namespace JobPilot.Terminal.Updates;

/// <summary>Downloads, validates, and installs host releases.</summary>
public sealed class ReleaseInstaller(GitHubReleaseClient releases, ILogger<ReleaseInstaller> logger)
{
    /// <summary>
    /// Stages and validates a release, renames the running executable, and copies the release over the
    /// install directory. The executable is restored if copying fails; other files self-heal next update.
    /// </summary>
    public async Task SwapAsync(string url, string exePath, string installDir, CancellationToken ct)
    {
        var staging = installDir.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + ".new";
        DeleteIfExists(staging);
        Directory.CreateDirectory(staging);

        try
        {
            await DownloadAndExtractAsync(url, staging, ct);

            var exeName = Path.GetFileName(exePath);
            if (!IsValidHost(staging, exeName))
            {
                throw new InvalidOperationException("Downloaded host failed validation; keeping the current binary.");
            }

            var oldExe = exePath + ".old";
            File.Delete(oldExe);
            File.Move(exePath, oldExe);
            try
            {
                CopyOver(staging, installDir);
                PruneRemovedPluginFiles(staging, installDir);
            }
            catch
            {
                File.Move(oldExe, exePath, overwrite: true);
                throw;
            }

            if (!OperatingSystem.IsWindows())
            {
                File.Delete(oldExe); // Windows keeps the running image until the next startup.
            }
        }
        finally
        {
            DeleteIfExists(staging);
        }
    }

    /// <summary>Deletes the previous executable after its process exits.</summary>
    public void CleanupPreviousSwap()
    {
        if (Environment.ProcessPath is null)
        {
            return;
        }
        try
        {
            File.Delete(Environment.ProcessPath + ".old");
        }
        catch (Exception ex)
        {
            logger.LogInformation(ex, "Could not remove the previous host binary; it will be retried next startup.");
        }
    }

    /// <summary>Launches the installed binary with the current arguments; it waits for this process's port.</summary>
    public void Relaunch(string exePath)
    {
        var psi = new ProcessStartInfo
        {
            FileName = exePath,
            UseShellExecute = false,
            WorkingDirectory = Environment.CurrentDirectory,
        };
        foreach (var arg in Environment.GetCommandLineArgs().Skip(1))
        {
            psi.ArgumentList.Add(arg);
        }
        psi.Environment[HostHandoff.AwaitPidVar] = Environment.ProcessId.ToString(CultureInfo.InvariantCulture);
        Process.Start(psi);
    }

    /// <summary>Downloads and extracts a release archive.</summary>
    private async Task DownloadAndExtractAsync(string url, string destDir, CancellationToken ct)
    {
        var archive = Path.GetTempFileName();
        try
        {
            await releases.DownloadAsync(url, archive, ct);

            if (url.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
            {
                ZipFile.ExtractToDirectory(archive, destDir, overwriteFiles: true);
            }
            else
            {
                await using var file = File.OpenRead(archive);
                await using var gzip = new GZipStream(file, CompressionMode.Decompress);
                TarFile.ExtractToDirectory(gzip, destDir, overwriteFiles: true);
            }
        }
        finally
        {
            File.Delete(archive);
        }
    }

    public static void DeleteIfExists(string dir)
    {
        if (Directory.Exists(dir))
        {
            Directory.Delete(dir, recursive: true);
        }
    }

    /// <summary>Checks the minimum release payload.</summary>
    internal static bool IsValidHost(string dir, string exeName)
    {
        return File.Exists(Path.Combine(dir, exeName))
            && File.Exists(Path.Combine(dir, "plugin", ".claude-plugin", "plugin.json"));
    }

    /// <summary>Copies every staged file onto the install directory.</summary>
    internal static void CopyOver(string stagingDir, string installDir)
    {
        foreach (var file in Directory.GetFiles(stagingDir, "*", SearchOption.AllDirectories))
        {
            var target = Path.Combine(installDir, Path.GetRelativePath(stagingDir, file));
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            File.Copy(file, target, overwrite: true);
        }
    }

    /// <summary>
    /// Deletes plugin files the new release no longer ships. Only the plugin/ subtree is pruned: the
    /// install dir is also the session working dir, so everything outside it may hold user state.
    /// </summary>
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

        DeleteEmptyDirectories(installedPlugin);
    }

    private static void DeleteEmptyDirectories(string root)
    {
        // Deepest first so emptied parents follow their children.
        foreach (var dir in Directory.GetDirectories(root, "*", SearchOption.AllDirectories)
                     .OrderByDescending(d => d.Length))
        {
            try
            {
                if (!Directory.EnumerateFileSystemEntries(dir).Any())
                {
                    Directory.Delete(dir);
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
            }
        }
    }
}

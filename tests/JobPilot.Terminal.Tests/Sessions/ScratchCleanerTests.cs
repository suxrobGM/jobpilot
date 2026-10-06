using JobPilot.Terminal.Hosting;
using JobPilot.Terminal.Sessions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests;

public sealed class ScratchCleanerTests : IDisposable
{
    private readonly TempDir temp = new();
    private readonly InstallPaths paths;
    private readonly ScratchCleaner cleaner = new(new HostInstall(paths: null), NullLogger<ScratchCleaner>.Instance);

    public ScratchCleanerTests() =>
        paths = new InstallPaths { WorkingDir = temp.Root, PluginDir = Path.Combine(temp.Root, "plugin") };

    public void Dispose()
    {
        cleaner.Dispose();
        temp.Dispose();
    }

    private string AgedFile(string relativePath)
    {
        var full = temp.File(relativePath);
        File.SetLastWriteTimeUtc(full, DateTime.UtcNow - ScratchCleaner.Retention - TimeSpan.FromHours(1));
        return full;
    }

    [Fact]
    public void CleanSessionStart_RemovesTopLevelPlaywrightScratch_RegardlessOfAge()
    {
        var fresh = temp.File(Path.Combine(".playwright-mcp", "console-fresh.log"));
        var aged = AgedFile(Path.Combine(".playwright-mcp", "screenshot.png"));

        cleaner.CleanSessionStart(paths);

        Assert.False(File.Exists(fresh));
        Assert.False(File.Exists(aged));
    }

    [Fact]
    public void CleanSessionStart_KeepsUnknownExtensionsAndTheBrowserProfile()
    {
        var db = temp.File(Path.Combine(".playwright-mcp", "first_party_sets.db"));
        var profile = temp.File(Path.Combine(".playwright-mcp", "Default", "Preferences.json"));

        cleaner.CleanSessionStart(paths);

        Assert.True(File.Exists(db));
        Assert.True(File.Exists(profile));
    }

    [Fact]
    public void CleanSessionStart_RemovesAgedTempFiles_KeepsFreshOnes()
    {
        var aged = AgedFile(Path.Combine(".temp", "old-resume.pdf"));
        var fresh = temp.File(Path.Combine(".temp", "current-job.json"));

        cleaner.CleanSessionStart(paths);

        Assert.False(File.Exists(aged));
        Assert.True(File.Exists(fresh));
    }

    [Fact]
    public void CleanSessionStart_IsANoOp_WhenScratchDirectoriesAreAbsent()
    {
        cleaner.CleanSessionStart(paths);
    }

    [Fact]
    public void CleanTemp_HasNoExtensionAllowlist_TheWholeTreeIsScratch()
    {
        var aged = AgedFile(Path.Combine(".temp", "notes.anything"));

        cleaner.CleanTemp(paths);

        Assert.False(File.Exists(aged));
    }

    [Fact]
    public void CleanTemp_PrunesEmptiedSubdirectories_KeepsTempItself()
    {
        AgedFile(Path.Combine(".temp", "job-a", "resume.pdf"));
        var keptDirFile = temp.File(Path.Combine(".temp", "job-b", "digest.json"));

        cleaner.CleanTemp(paths);

        Assert.False(Directory.Exists(Path.Combine(temp.Root, ".temp", "job-a")));
        Assert.True(File.Exists(keptDirFile));
        Assert.True(Directory.Exists(Path.Combine(temp.Root, ".temp")));
    }

    [Fact]
    public void CleanPlaywright_AgedSweep_KeepsFreshLogs()
    {
        var aged = AgedFile(Path.Combine(".playwright-mcp", "console-old.log"));
        var fresh = temp.File(Path.Combine(".playwright-mcp", "console-live.log"));

        cleaner.CleanPlaywright(paths, ScratchCleaner.Retention);

        Assert.False(File.Exists(aged));
        Assert.True(File.Exists(fresh));
    }

    [Fact]
    public void CleanPlaywright_SweepsEveryParallelBrowserProfile()
    {
        var second = AgedFile(Path.Combine(".playwright-mcp-2", "console-old.log"));
        var third = AgedFile(Path.Combine(".playwright-mcp-3", "screenshot.png"));

        cleaner.CleanPlaywright(paths, ScratchCleaner.Retention);

        Assert.False(File.Exists(second));
        Assert.False(File.Exists(third));
    }

    [Fact]
    public void CleanPlaywright_NeverRecursesIntoProfileSubdirectories()
    {
        var profileLog = AgedFile(Path.Combine(".playwright-mcp", "Default", "chrome_debug.log"));

        cleaner.CleanPlaywright(paths, maxAge: null);

        Assert.True(File.Exists(profileLog));
    }
}

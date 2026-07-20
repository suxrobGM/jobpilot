using JobPilot.Terminal.Updates;
using Xunit;

namespace JobPilot.Terminal.Tests;

public class ReleaseInstallerTests
{
    private static string Install(TempDir temp) => Path.Combine(temp.Root, "install");

    private static string Staging(TempDir temp) => Path.Combine(temp.Root, "staging");

    [Fact]
    public void CopyOver_OverwritesExistingFilesAndAddsNewOnes()
    {
        using var temp = new TempDir();

        temp.File(Path.Combine("install", "jobpilot.exe"), "old binary");
        temp.File(Path.Combine("staging", "jobpilot.exe"), "new binary");
        temp.File(Path.Combine("staging", "plugin", "skills", "new-skill.md"), "fresh");

        ReleaseInstaller.CopyOver(Staging(temp), Install(temp));

        Assert.Equal("new binary", File.ReadAllText(Path.Combine(Install(temp), "jobpilot.exe")));
        Assert.Equal("fresh", File.ReadAllText(Path.Combine(Install(temp), "plugin", "skills", "new-skill.md")));
    }

    [Fact]
    public void Prune_RemovesPluginFilesTheNewReleaseNoLongerShips()
    {
        using var temp = new TempDir();

        temp.File(Path.Combine("install", "plugin", "skills", "kept", "SKILL.md"), "old");
        temp.File(Path.Combine("install", "plugin", "skills", "removed", "SKILL.md"), "stale");
        temp.File(Path.Combine("staging", "plugin", "skills", "kept", "SKILL.md"), "new");

        ReleaseInstaller.CopyOver(Staging(temp), Install(temp));
        ReleaseInstaller.PruneRemovedPluginFiles(Staging(temp), Install(temp));

        Assert.Equal("new", File.ReadAllText(Path.Combine(Install(temp), "plugin", "skills", "kept", "SKILL.md")));
        Assert.False(File.Exists(Path.Combine(Install(temp), "plugin", "skills", "removed", "SKILL.md")));
        Assert.False(Directory.Exists(Path.Combine(Install(temp), "plugin", "skills", "removed")));
    }

    [Fact]
    public void Prune_NeverTouchesFilesOutsideThePluginSubtree()
    {
        using var temp = new TempDir();

        // The install dir doubles as the session working dir; user state there must survive updates.
        temp.File(Path.Combine("install", "user-notes.md"), "user state");
        temp.File(Path.Combine("install", "plugin", "skills", "a.md"), "old");
        temp.File(Path.Combine("staging", "plugin", "skills", "a.md"), "new");

        ReleaseInstaller.CopyOver(Staging(temp), Install(temp));
        ReleaseInstaller.PruneRemovedPluginFiles(Staging(temp), Install(temp));

        Assert.Equal("user state", File.ReadAllText(Path.Combine(Install(temp), "user-notes.md")));
    }

    [Fact]
    public void IsValidHost_RequiresBothTheBinaryAndTheClaudeManifest()
    {
        using var temp = new TempDir();

        Assert.False(ReleaseInstaller.IsValidHost(temp.Root, "jobpilot"));

        temp.File("jobpilot", "binary");
        Assert.False(ReleaseInstaller.IsValidHost(temp.Root, "jobpilot"));

        temp.File(Path.Combine("plugin", ".claude-plugin", "plugin.json"));
        Assert.True(ReleaseInstaller.IsValidHost(temp.Root, "jobpilot"));
    }
}

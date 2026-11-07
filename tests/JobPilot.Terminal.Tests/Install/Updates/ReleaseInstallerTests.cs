using JobPilot.Terminal.Common;
using JobPilot.Terminal.Install.Updates;
using JobPilot.Terminal.Tests.Support;
using Xunit;

namespace JobPilot.Terminal.Tests.Install.Updates;

public class ReleaseInstallerTests
{
    [Fact]
    public void PruneRemovedPluginFiles_DeletesWhatTheReleaseDropped_AndNothingOutsidePlugin()
    {
        using var temp = new TempDir();
        var install = Path.Combine(temp.Root, "install");
        var staging = Path.Combine(temp.Root, "staging");
        temp.File(Path.Combine("install", "user-notes.md"), "user state");
        temp.File(Path.Combine("install", "plugin", "skills", "kept", "SKILL.md"), "old");
        temp.File(Path.Combine("install", "plugin", "skills", "removed", "SKILL.md"), "stale");
        temp.File(Path.Combine("staging", "plugin", "skills", "kept", "SKILL.md"), "new");

        FileTree.Copy(staging, install);
        ReleaseInstaller.PruneRemovedPluginFiles(staging, install);

        Assert.Equal("new", File.ReadAllText(Path.Combine(install, "plugin", "skills", "kept", "SKILL.md")));
        Assert.False(Directory.Exists(Path.Combine(install, "plugin", "skills", "removed")));
        Assert.Equal("user state", File.ReadAllText(Path.Combine(install, "user-notes.md")));
    }

    [Fact]
    public void IsValidHost_RequiresTheBinaryAndACompletePluginTree()
    {
        using var temp = new TempDir();

        temp.File("jobpilot", "binary");
        Assert.False(ReleaseInstaller.IsValidHost(temp.Root, "jobpilot"));

        temp.WriteValidPluginTree();
        Assert.True(ReleaseInstaller.IsValidHost(temp.Root, "jobpilot"));
    }
}

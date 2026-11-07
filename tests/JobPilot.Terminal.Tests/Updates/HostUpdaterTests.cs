using JobPilot.Terminal.Common;
using JobPilot.Terminal.Updates;
using Xunit;

namespace JobPilot.Terminal.Tests;

public class HostUpdaterTests
{
    private static readonly Version Current = new(2, 0, 8);

    private static GitHubRelease[] Releases(string tags) =>
        [.. tags.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(tag => new GitHubRelease(tag, Assets: null))];

    [Theory]
    [InlineData("v2.0.9", "v2.0.9")]
    [InlineData("v2.1.0,v3.0.0,v2.9.9", "v3.0.0")]
    [InlineData("plugin-9.9.9,9.9.9,vNext,v,v2.1.0", "v2.1.0")]
    public void FindNewer_PicksTheHighestVTaggedVersion(string tags, string expected)
    {
        Assert.Equal(expected, ReleaseFeed.FindNewer(Releases(tags), Current)?.Release.TagName);
    }

    [Theory]
    [InlineData("")]
    [InlineData("v1.0.0,v2.0.8")]
    public void FindNewer_IsNull_WhenNothingIsNewer(string tags)
    {
        Assert.Null(ReleaseFeed.FindNewer(Releases(tags), Current));
    }

    [Fact]
    public void FindNewer_SkipsAReleaseWithNoTag()
    {
        Assert.Equal("v2.1.0", ReleaseFeed.FindNewer([new(null, null), new("v2.1.0", null)], Current)?.Release.TagName);
    }

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
        InstallSwap.PruneRemovedPluginFiles(staging, install);

        Assert.Equal("new", File.ReadAllText(Path.Combine(install, "plugin", "skills", "kept", "SKILL.md")));
        Assert.False(Directory.Exists(Path.Combine(install, "plugin", "skills", "removed")));
        Assert.Equal("user state", File.ReadAllText(Path.Combine(install, "user-notes.md")));
    }

    [Fact]
    public void IsValidHost_RequiresTheBinaryAndACompletePluginTree()
    {
        using var temp = new TempDir();

        temp.File("jobpilot", "binary");
        Assert.False(InstallSwap.IsValidHost(temp.Root, "jobpilot"));

        temp.WriteValidPluginTree();
        Assert.True(InstallSwap.IsValidHost(temp.Root, "jobpilot"));
    }
}

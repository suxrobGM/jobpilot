using JobPilot.Terminal.Install.Updates;
using Xunit;

namespace JobPilot.Terminal.Tests.Install.Updates;

public class GitHubReleasesTests
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
        Assert.Equal(expected, GitHubReleases.FindNewer(Releases(tags), Current)?.Release.TagName);
    }

    [Theory]
    [InlineData("")]
    [InlineData("v1.0.0,v2.0.8")]
    public void FindNewer_IsNull_WhenNothingIsNewer(string tags)
    {
        Assert.Null(GitHubReleases.FindNewer(Releases(tags), Current));
    }

    [Fact]
    public void FindNewer_SkipsAReleaseWithNoTag()
    {
        Assert.Equal("v2.1.0", GitHubReleases.FindNewer([new(null, null), new("v2.1.0", null)], Current)?.Release.TagName);
    }
}

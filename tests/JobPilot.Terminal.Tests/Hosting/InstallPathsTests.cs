using JobPilot.Terminal.Contracts;
using JobPilot.Terminal.Hosting;
using Xunit;

namespace JobPilot.Terminal.Tests;

public class InstallPathsTests
{
    [Fact]
    public void ResolveFrom_FindsACompletePluginTree()
    {
        using var temp = new TempDir();
        temp.WriteValidPluginTree();

        var paths = InstallPaths.ResolveFrom([temp.Root]);

        Assert.Equal(temp.Root, paths.WorkingDir);
        Assert.Equal(Path.Combine(temp.Root, "plugin"), paths.PluginDir);
        Assert.Equal(Path.Combine(temp.Root, "plugin", "skills"), paths.SkillsDir);
    }

    [Fact]
    public void ResolveFrom_PrefersTheFirstMatchingRoot()
    {
        using var first = new TempDir();
        using var second = new TempDir();
        first.WriteValidPluginTree();
        second.WriteValidPluginTree();

        var paths = InstallPaths.ResolveFrom([first.Root, second.Root]);

        Assert.Equal(first.Root, paths.WorkingDir);
    }

    [Fact]
    public void CandidateRoots_PrefersTheExecutableLayout_OverTheLaunchDirectory()
    {
        using var published = new TempDir();
        using var checkout = new TempDir();
        published.WriteValidPluginTree();
        checkout.WriteValidPluginTree();

        var paths = InstallPaths.ResolveFrom(InstallPaths.CandidateRoots(published.Root, checkout.Root));

        Assert.Equal(published.Root, paths.WorkingDir);
    }

    [Fact]
    public void ResolveFrom_SkipsRootsMissingTheCodexManifest()
    {
        using var incomplete = new TempDir();
        using var complete = new TempDir();
        incomplete.WriteValidPluginTree();
        File.Delete(Path.Combine(incomplete.Root, "plugin", ".codex-plugin", "plugin.json"));
        complete.WriteValidPluginTree();

        var paths = InstallPaths.ResolveFrom([incomplete.Root, complete.Root]);

        Assert.Equal(complete.Root, paths.WorkingDir);
    }

    [Theory]
    [InlineData("skills/_shared/setup.md")]
    [InlineData("skills/auto-apply/SKILL.md")]
    [InlineData(".claude-plugin/plugin.json")]
    [InlineData(".codex-plugin/plugin.json")]
    public void ResolveFrom_Throws_WhenAnyProbedFileIsMissing(string missing)
    {
        using var temp = new TempDir();
        temp.WriteValidPluginTree();
        File.Delete(Path.Combine(temp.Root, "plugin", missing.Replace('/', Path.DirectorySeparatorChar)));

        Assert.Throws<DirectoryNotFoundException>(() => InstallPaths.ResolveFrom([temp.Root]));
    }

    [Fact]
    public void ResolveFrom_Throws_WhenNoRootMatches()
    {
        using var temp = new TempDir();
        Assert.Throws<DirectoryNotFoundException>(() => InstallPaths.ResolveFrom([temp.Root]));
    }

    [Fact]
    public void IsInstallRoot_IsTrue_ForABundledPluginTree()
    {
        using var temp = new TempDir();
        temp.WriteValidPluginTree();

        Assert.True(InstallPaths.IsInstallRoot(temp.Root));
    }

    [Fact]
    public void IsInstallRoot_IsFalse_ForABuildOutputWithoutAPluginTree()
    {
        using var temp = new TempDir();
        temp.File("jobpilot.exe");

        Assert.False(InstallPaths.IsInstallRoot(temp.Root));
    }
}

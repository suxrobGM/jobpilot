using JobPilot.Terminal.Common;
using JobPilot.Terminal.Tests.Support;
using Xunit;

namespace JobPilot.Terminal.Tests.Common;

public class FileTreeTests
{
    [Fact]
    public void Copy_OverwritesExistingFiles_AndAddsNewOnes()
    {
        using var temp = new TempDir();
        temp.File(Path.Combine("target", "jobpilot.exe"), "old binary");
        temp.File(Path.Combine("source", "jobpilot.exe"), "new binary");
        temp.File(Path.Combine("source", "plugin", "skills", "new-skill.md"), "fresh");
        var target = Path.Combine(temp.Root, "target");

        FileTree.Copy(Path.Combine(temp.Root, "source"), target);

        Assert.Equal("new binary", File.ReadAllText(Path.Combine(target, "jobpilot.exe")));
        Assert.Equal("fresh", File.ReadAllText(Path.Combine(target, "plugin", "skills", "new-skill.md")));
    }
}

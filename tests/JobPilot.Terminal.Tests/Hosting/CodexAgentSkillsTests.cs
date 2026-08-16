using JobPilot.Terminal.Hosting;
using Xunit;

namespace JobPilot.Terminal.Tests;

public sealed class CodexAgentSkillsTests : IDisposable
{
    private readonly TempDir temp = new();

    private string Source => Path.Combine(temp.Root, "plugin", "skills");

    private string Mirrored => Path.Combine(temp.Root, ".agents", "skills");

    public void Dispose() => temp.Dispose();

    [Fact]
    public void Refresh_CopiesTheBundledTreeAndDropsEverythingElse()
    {
        temp.File(Path.Combine("plugin", "skills", "pilot", "SKILL.md"), "pilot-v1");
        temp.File(Path.Combine("plugin", "skills", "retired", "SKILL.md"), "retired");
        temp.File(Path.Combine("plugin", "skills", "setup", "SKILL.md"), "bootstrap");
        temp.File(Path.Combine("plugin", "skills", "_shared", "setup.md"), "shared");

        CodexAgentSkills.Refresh(Source, temp.Root);
        temp.File(Path.Combine(".agents", "skills", "pilot", "stale.md"), "stale");
        temp.File(Path.Combine("plugin", "skills", "pilot", "SKILL.md"), "pilot-v2");
        Directory.Delete(Path.Combine(Source, "retired"), recursive: true);

        CodexAgentSkills.Refresh(Source, temp.Root);

        Assert.Equal("pilot-v2", File.ReadAllText(Path.Combine(Mirrored, "pilot", "SKILL.md")));
        Assert.Equal("shared", File.ReadAllText(Path.Combine(Mirrored, "_shared", "setup.md")));
        Assert.False(Directory.Exists(Path.Combine(Mirrored, "setup")));
        Assert.False(Directory.Exists(Path.Combine(Mirrored, "retired")));
        Assert.False(File.Exists(Path.Combine(Mirrored, "pilot", "stale.md")));
    }
}

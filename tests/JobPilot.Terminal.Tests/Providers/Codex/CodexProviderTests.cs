using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Tests.Support;
using Xunit;

namespace JobPilot.Terminal.Tests.Providers.Codex;

public sealed class CodexProviderTests : IDisposable
{
    private readonly TempDir temp = new();

    public void Dispose() => temp.Dispose();

    [Fact]
    public void PrepareWorkspace_MirrorsSkillsAndAgents_WithoutTheBootstrapOrStaleFiles()
    {
        temp.File(Path.Combine("plugin", "skills", "pilot", "SKILL.md"), "pilot-v1");
        temp.File(Path.Combine("plugin", "skills", "retired", "SKILL.md"), "retired");
        temp.File(Path.Combine("plugin", "skills", "setup", "SKILL.md"), "bootstrap");
        temp.File(Path.Combine("plugin", "skills", "_shared", "setup.md"), "shared");
        temp.File(Path.Combine("plugin", "agents", "job-scorer.md"), "---\nname: job-scorer\ndescription: Scores.\n---\nBody");
        temp.File(Path.Combine(".codex", "agents", "job-worker.toml"), "stale");
        var paths = temp.Paths;
        var mirrored = Path.Combine(temp.Root, ".agents", "skills");

        Provider.Codex.PrepareWorkspace(paths);
        temp.File(Path.Combine(".agents", "skills", "pilot", "stale.md"), "stale");
        temp.File(Path.Combine("plugin", "skills", "pilot", "SKILL.md"), "pilot-v2");
        Directory.Delete(Path.Combine(paths.SkillsDir, "retired"), recursive: true);
        Provider.Codex.PrepareWorkspace(paths);

        Assert.Equal("pilot-v2", File.ReadAllText(Path.Combine(mirrored, "pilot", "SKILL.md")));
        Assert.Equal("shared", File.ReadAllText(Path.Combine(mirrored, "_shared", "setup.md")));
        Assert.False(Directory.Exists(Path.Combine(mirrored, "setup")));
        Assert.False(Directory.Exists(Path.Combine(mirrored, "retired")));
        Assert.False(File.Exists(Path.Combine(mirrored, "pilot", "stale.md")));

        var agents = Path.Combine(temp.Root, ".codex", "agents");
        Assert.Equal(["job-scorer.toml"], Directory.GetFiles(agents).Select(Path.GetFileName));
        Assert.Contains("developer_instructions = 'Body'", File.ReadAllText(Path.Combine(agents, "job-scorer.toml")));
    }
}

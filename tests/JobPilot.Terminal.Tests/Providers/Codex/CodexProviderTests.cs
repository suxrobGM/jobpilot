using JobPilot.Terminal.Install;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Providers.Codex;
using JobPilot.Terminal.Tests.Support;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests.Providers.Codex;

public sealed class CodexProviderTests : IDisposable
{
    private readonly TempDir temp = new();

    public void Dispose() => temp.Dispose();

    private string[] Overrides(Func<string, string?> resolve) =>
        CodexProvider.ConfigOverrides(temp.Root, NullLogger.Instance, resolve);

    [Fact]
    public void ConfigOverrides_TranslatesAStdioMcpServer()
    {
        temp.File(
            ".mcp.json",
            """{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest","--snapshot-mode","none"]}}}""");

        Assert.Equal(
            [
                "mcp_servers.playwright.command=\"/usr/bin/npx\"",
                "mcp_servers.playwright.args=[\"@playwright/mcp@latest\",\"--snapshot-mode\",\"none\"]",
                "mcp_servers.playwright.startup_timeout_sec=120"
            ],
            Overrides(_ => "/usr/bin/npx"));
    }

    [Fact]
    public void ConfigOverrides_RunsAWindowsShimThroughCmd()
    {
        temp.File(".mcp.json", """{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest"]}}}""");

        // Only Windows needs an interpreter for .cmd; elsewhere the direct spawn is right.
        string[] expected = OperatingSystem.IsWindows()
            ?
            [
                "mcp_servers.playwright.command=\"cmd.exe\"",
                "mcp_servers.playwright.args=[\"/c\",\"/tools/npx.cmd\",\"@playwright/mcp@latest\"]",
                "mcp_servers.playwright.startup_timeout_sec=120"
            ]
            :
            [
                "mcp_servers.playwright.command=\"/tools/npx.cmd\"",
                "mcp_servers.playwright.args=[\"@playwright/mcp@latest\"]",
                "mcp_servers.playwright.startup_timeout_sec=120"
            ];

        Assert.Equal(expected, Overrides(_ => "/tools/npx.cmd"));
    }

    [Fact]
    public void ConfigOverrides_PutsSettingsFirst_ThenStdioAndRemoteServers()
    {
        temp.File(Path.Combine("settings", "codex.json"), """{"configOverrides":["a=1"]}""");
        temp.File(
            ".mcp.json",
            """
            {"mcpServers":{
              "playwright":{"command":"npx"},
              "upwork":{"type":"http","url":"https://mcp.upwork.com/mcp"}
            }}
            """);

        var overrides = Overrides(_ => "/usr/bin/npx");

        Assert.Equal("a=1", overrides[0]);
        Assert.Contains("mcp_servers.playwright.command=\"/usr/bin/npx\"", overrides);
        Assert.Contains("mcp_servers.upwork.url=\"https://mcp.upwork.com/mcp\"", overrides);
    }

    [Theory]
    [InlineData("""{"mcpServers":{"playwright":{"command":"not-on-path"}}}""")]
    [InlineData("""{"mcpServers":{"play wright":{"command":"npx"}}}""")]
    [InlineData("""{"mcpServers":{"playwright":{"args":["pkg"]}}}""")]
    public void ConfigOverrides_SkipsAServerCodexCannotLoad(string mcpJson)
    {
        temp.File(".mcp.json", mcpJson);

        Assert.Empty(Overrides(command => command == "npx" ? "/usr/bin/npx" : null));
    }

    [Fact]
    public void ConfigOverrides_IsEmpty_WhenFilesAreMissingOrMalformed()
    {
        Assert.Empty(Overrides(_ => null));

        temp.File(Path.Combine("settings", "codex.json"), "{ not json");
        Assert.Empty(Overrides(_ => null));
    }

    [Fact]
    public void PrepareWorkspace_MirrorsSkillsAndAgents_WithoutTheBootstrapOrStaleFiles()
    {
        temp.File(Path.Combine("plugin", "skills", "pilot", "SKILL.md"), "pilot-v1");
        temp.File(Path.Combine("plugin", "skills", "retired", "SKILL.md"), "retired");
        temp.File(Path.Combine("plugin", "skills", "setup", "SKILL.md"), "bootstrap");
        temp.File(Path.Combine("plugin", "skills", "_shared", "setup.md"), "shared");
        temp.File(Path.Combine("plugin", "agents", "job-scorer.md"), "---\nname: job-scorer\ndescription: Scores.\n---\nBody");
        temp.File(Path.Combine(".codex", "agents", "job-worker.toml"), "stale");
        var paths = new InstallPaths { WorkingDir = temp.Root, PluginDir = Path.Combine(temp.Root, "plugin") };
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

    [Fact]
    public void AgentToml_InlinesTheBody_UnderTheFrontmattersNameAndDescription()
    {
        const string markdown = """
            ---
            name: job-scorer
            description: >-
              Scores one posting
              for a feed.
            tools: Bash, Read
            model: inherit
            ---

            # Job Scorer

            Say "hi".
            """;

        Assert.Equal(
            "name = 'job-scorer'\n"
            + "description = 'Scores one posting for a feed.'\n"
            + "developer_instructions = '''\n# Job Scorer\n\nSay \"hi\".'''\n",
            CodexProvider.AgentToml(markdown));
        Assert.Null(CodexProvider.AgentToml("# No frontmatter"));
    }

    [Fact]
    public void AgentToml_EscapesText_ALiteralStringCannotHold()
    {
        const string markdown = """
            ---
            name: job-scorer
            description: The user's scorer
            ---

            Never write ''' here.
            """;

        Assert.Equal(
            "name = 'job-scorer'\n"
            + "description = '''The user's scorer'''\n"
            + "developer_instructions = \"Never write \\u0027\\u0027\\u0027 here.\"\n",
            CodexProvider.AgentToml(markdown));
    }

    [Fact]
    public void CheckedInCodexAgents_MatchThePluginAgents()
    {
        var repo = new DirectoryInfo(AppContext.BaseDirectory);
        while (!File.Exists(Path.Combine(repo.FullName, "JobPilot.slnx")))
        {
            repo = repo.Parent!;
        }

        var sources = Directory.GetFiles(Path.Combine(repo.FullName, "plugin", "agents"), "*.md").Order().ToArray();
        var checkedIn = Directory.GetFiles(Path.Combine(repo.FullName, ".codex", "agents"), "*.toml").Order().ToArray();

        // Codex run straight from the repo reads these; a Codex session through the host rewrites them.
        Assert.Equal(sources.Select(Path.GetFileNameWithoutExtension), checkedIn.Select(Path.GetFileNameWithoutExtension));
        Assert.Equal(sources.Select(md => CodexProvider.AgentToml(File.ReadAllText(md))), checkedIn.Select(File.ReadAllText));
    }
}

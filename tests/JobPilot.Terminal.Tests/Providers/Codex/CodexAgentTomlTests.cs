using JobPilot.Terminal.Providers.Codex;
using Xunit;

namespace JobPilot.Terminal.Tests.Providers.Codex;

public sealed class CodexAgentTomlTests
{
    [Fact]
    public void From_InlinesTheBody_UnderTheFrontmattersNameAndDescription()
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
            CodexAgentToml.From(markdown));
        Assert.Null(CodexAgentToml.From("# No frontmatter"));
    }

    [Fact]
    public void From_EscapesText_ALiteralStringCannotHold()
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
            CodexAgentToml.From(markdown));
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
        Assert.Equal(sources.Select(md => CodexAgentToml.From(File.ReadAllText(md))), checkedIn.Select(File.ReadAllText));
    }
}

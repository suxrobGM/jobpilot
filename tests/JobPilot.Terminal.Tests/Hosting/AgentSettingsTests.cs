using JobPilot.Terminal.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests;

public class AgentSettingsTests
{
    [Fact]
    public void ClaudeSettingsFile_ReturnsThePath_WhenTheFileExists()
    {
        using var temp = new TempDir();
        var claudePath = temp.File(Path.Combine("settings", "claude.json"), """{"model":"sonnet"}""");

        Assert.Equal(claudePath, AgentSettings.ClaudeSettingsFile(temp.Root, NullLogger.Instance));
    }

    [Fact]
    public void ClaudeSettingsFile_ReturnsNull_WhenTheFileIsMissing()
    {
        using var temp = new TempDir();

        Assert.Null(AgentSettings.ClaudeSettingsFile(temp.Root, NullLogger.Instance));
    }

    [Fact]
    public void CodexConfigOverrides_ReadsEveryOverride()
    {
        using var temp = new TempDir();
        temp.File(
            Path.Combine("settings", "codex.json"),
            """{"configOverrides":["sandbox_workspace_write.network_access=true","hide_agent_reasoning=true"]}""");

        Assert.Equal(
            ["sandbox_workspace_write.network_access=true", "hide_agent_reasoning=true"],
            AgentSettings.CodexConfigOverrides(temp.Root, NullLogger.Instance));
    }

    [Fact]
    public void CodexConfigOverrides_TranslatesBundledStdioMcpServers()
    {
        using var temp = new TempDir();
        temp.File(
            ".mcp.json",
            """{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest","--snapshot-mode","none"]}}}""");

        Assert.Equal(
            [
                "mcp_servers.\"playwright\".command=\"npx\"",
                "mcp_servers.\"playwright\".args=[\"@playwright/mcp@latest\",\"--snapshot-mode\",\"none\"]"
            ],
            AgentSettings.CodexConfigOverrides(temp.Root, NullLogger.Instance));
    }

    [Fact]
    public void CodexConfigOverrides_SkipsAnMcpServerWithoutACommand()
    {
        using var temp = new TempDir();
        temp.File(".mcp.json", """{"mcpServers":{"playwright":{"args":["pkg"]}}}""");

        Assert.Empty(AgentSettings.CodexConfigOverrides(temp.Root, NullLogger.Instance));
    }

    [Fact]
    public void CodexConfigOverrides_IsEmpty_WhenTheFileIsMissing()
    {
        using var temp = new TempDir();

        Assert.Empty(AgentSettings.CodexConfigOverrides(temp.Root, NullLogger.Instance));
    }

    [Fact]
    public void CodexConfigOverrides_IsEmpty_WhenTheFileIsMalformed()
    {
        using var temp = new TempDir();
        temp.File(Path.Combine("settings", "codex.json"), "{ not json");

        Assert.Empty(AgentSettings.CodexConfigOverrides(temp.Root, NullLogger.Instance));
    }
}

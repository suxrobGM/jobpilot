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
            """{"configOverrides":["sandbox_workspace_write.network_access=true","windows.sandbox=\"unelevated\"","developer_instructions=\"trusted API context\""]}""");

        Assert.Equal(
            [
                "sandbox_workspace_write.network_access=true",
                "windows.sandbox=\"unelevated\"",
                "developer_instructions=\"trusted API context\""
            ],
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
                "mcp_servers.playwright.command=\"/usr/bin/npx\"",
                "mcp_servers.playwright.args=[\"@playwright/mcp@latest\",\"--snapshot-mode\",\"none\"]",
                "mcp_servers.playwright.startup_timeout_sec=120"
            ],
            AgentSettings.CodexConfigOverrides(temp.Root, NullLogger.Instance, _ => "/usr/bin/npx"));
    }

    [Fact]
    public void CodexConfigOverrides_RunsAWindowsShimThroughCmd()
    {
        using var temp = new TempDir();
        temp.File(
            ".mcp.json",
            """{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest"]}}}""");

        var overrides = AgentSettings.CodexConfigOverrides(
            temp.Root,
            NullLogger.Instance,
            _ => "/tools/npx.cmd");

        // Only Windows treats .cmd as needing an interpreter. Elsewhere the direct spawn is right.
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

        Assert.Equal(expected, overrides);
    }

    [Fact]
    public void CodexConfigOverrides_SkipsAnMcpServerWhoseCommandIsNotOnPath()
    {
        using var temp = new TempDir();
        temp.File(".mcp.json", """{"mcpServers":{"playwright":{"command":"npx"}}}""");

        Assert.Empty(AgentSettings.CodexConfigOverrides(temp.Root, NullLogger.Instance, _ => null));
    }

    [Fact]
    public void CodexConfigOverrides_SkipsAnMcpServerWhoseNameCodexRejects()
    {
        using var temp = new TempDir();
        temp.File(".mcp.json", """{"mcpServers":{"play wright":{"command":"npx"}}}""");

        Assert.Empty(AgentSettings.CodexConfigOverrides(temp.Root, NullLogger.Instance, _ => "/usr/bin/npx"));
    }

    [Fact]
    public void CodexConfigOverrides_SkipsAnMcpServerWithoutACommand()
    {
        using var temp = new TempDir();
        temp.File(".mcp.json", """{"mcpServers":{"playwright":{"args":["pkg"]}}}""");

        Assert.Empty(AgentSettings.CodexConfigOverrides(temp.Root, NullLogger.Instance, _ => "/usr/bin/npx"));
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

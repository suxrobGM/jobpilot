using JobPilot.Terminal.Providers.Codex;
using JobPilot.Terminal.Tests.Support;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests.Providers.Codex;

public sealed class CodexConfigTests : IDisposable
{
    private readonly TempDir temp = new();

    public void Dispose() => temp.Dispose();

    private string[] Overrides(Func<string, string?> resolve) =>
        CodexConfig.Overrides(temp.Root, NullLogger.Instance, resolve);

    [Fact]
    public void Overrides_TranslatesAStdioMcpServer()
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
    public void Overrides_RunsAWindowsShimThroughCmd()
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
    public void Overrides_PutsSettingsFirst_ThenStdioAndRemoteServers()
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
    public void Overrides_SkipsAServerCodexCannotLoad(string mcpJson)
    {
        temp.File(".mcp.json", mcpJson);

        Assert.Empty(Overrides(command => command == "npx" ? "/usr/bin/npx" : null));
    }

    [Fact]
    public void Overrides_IsEmpty_WhenFilesAreMissingOrMalformed()
    {
        Assert.Empty(Overrides(_ => null));

        temp.File(Path.Combine("settings", "codex.json"), "{ not json");
        Assert.Empty(Overrides(_ => null));
    }
}

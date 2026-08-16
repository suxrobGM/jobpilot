using JobPilot.Terminal.Contracts;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests;

public class TerminalProvidersTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Normalize_DefaultsToClaude_WhenAbsent(string? provider)
    {
        Assert.Equal(TerminalProviders.Claude, TerminalProviders.Normalize(provider));
    }

    [Theory]
    [InlineData("claude", TerminalProviders.Claude)]
    [InlineData("CLAUDE", TerminalProviders.Claude)]
    [InlineData("  Claude  ", TerminalProviders.Claude)]
    [InlineData("codex", TerminalProviders.Codex)]
    [InlineData("CoDeX", TerminalProviders.Codex)]
    public void Normalize_IsCaseInsensitiveAndTrims(string input, string expected)
    {
        Assert.Equal(expected, TerminalProviders.Normalize(input));
    }

    [Theory]
    [InlineData("gemini")]
    [InlineData("claude-code")]
    public void Normalize_Throws_ForUnknownProvider(string input)
    {
        Assert.Throws<ArgumentException>(() => TerminalProviders.Normalize(input));
    }

    [Theory]
    [InlineData(TerminalProviders.Claude, "Claude Code")]
    [InlineData(TerminalProviders.Codex, "Codex")]
    public void GetDisplayName_MapsKnownProviders(string id, string expected)
    {
        Assert.Equal(expected, TerminalProviders.GetDisplayName(id));
    }

    [Fact]
    public void GetDisplayName_Throws_ForUnknownProvider()
    {
        Assert.Throws<ArgumentException>(() => TerminalProviders.GetDisplayName("gemini"));
    }

    [Fact]
    public void Supported_ExposesEveryProviderInTheTable()
    {
        Assert.Equal(
            [("claude", "Claude Code"), ("codex", "Codex")],
            TerminalProviders.Supported().Select(p => (p.Id, p.DisplayName)));
    }

    [Fact]
    public void Supported_AgreesWithNormalizeAndGetDisplayName()
    {
        foreach (var provider in TerminalProviders.Supported())
        {
            Assert.Equal(provider.Id, TerminalProviders.Normalize(provider.Id));
            Assert.Equal(provider.DisplayName, TerminalProviders.GetDisplayName(provider.Id));
        }
    }

    [Fact]
    public void GetLaunchSpec_Claude_StartsInAutoModeWithTheShippedSettings()
    {
        using var temp = new TempDir();
        var claudeSettings = temp.File(Path.Combine("settings", "claude.json"), """{"model":"sonnet"}""");

        var spec = TerminalProviders.GetLaunchSpec(TerminalProviders.Claude, temp.Root, NullLogger.Instance);

        Assert.Equal("claude", spec.Command);
        Assert.Equal(
            ["--permission-mode", "auto", "--settings", claudeSettings, "--plugin-dir", temp.Root],
            spec.Args);
        Assert.Equal("Claude Code", spec.Provider.DisplayName);
    }

    [Fact]
    public void GetLaunchSpec_Claude_StaysLaunchable_WithoutASettingsFile()
    {
        using var temp = new TempDir();

        var spec = TerminalProviders.GetLaunchSpec(TerminalProviders.Claude, temp.Root, NullLogger.Instance);

        Assert.Equal(["--permission-mode", "auto", "--plugin-dir", temp.Root], spec.Args);
    }

    [Fact]
    public void GetLaunchSpec_Codex_ReviewsApprovalsAndExpandsEveryConfigOverride()
    {
        using var temp = new TempDir();
        temp.File(
            Path.Combine("settings", "codex.json"),
            """{"configOverrides":["sandbox_workspace_write.network_access=true","hide_agent_reasoning=true"]}""");

        var spec = TerminalProviders.GetLaunchSpec(TerminalProviders.Codex, temp.Root, NullLogger.Instance);

        Assert.Equal("codex", spec.Command);
        Assert.Equal(
            [
                "--no-alt-screen", "--approve-for-me",
                "-c", "sandbox_workspace_write.network_access=true",
                "-c", "hide_agent_reasoning=true"
            ],
            spec.Args);
        Assert.Equal("Codex", spec.Provider.DisplayName);
    }

    [Fact]
    public void GetLaunchSpec_Codex_StaysLaunchable_WithoutASettingsFile()
    {
        using var temp = new TempDir();

        var spec = TerminalProviders.GetLaunchSpec(TerminalProviders.Codex, temp.Root, NullLogger.Instance);

        Assert.Equal(["--no-alt-screen", "--approve-for-me"], spec.Args);
    }

    [Fact]
    public void GetLaunchSpec_Codex_LoadsTheBundledMcpServer()
    {
        using var temp = new TempDir();
        temp.File(
            ".mcp.json",
            """{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest"]}}}""");

        var spec = TerminalProviders.GetLaunchSpec(TerminalProviders.Codex, temp.Root, NullLogger.Instance);

        // The TOML shape is pinned by AgentSettingsTests; this only proves .mcp.json reaches the -c arguments.
        var overrideIndex = Array.FindIndex(spec.Args, a => a.StartsWith("mcp_servers.", StringComparison.Ordinal));
        Assert.True(overrideIndex > 0);
        Assert.Equal("-c", spec.Args[overrideIndex - 1]);
    }

    [Fact]
    public void GetLaunchSpec_Throws_ForAnUnknownProvider()
    {
        Assert.Throws<ArgumentException>(
            () => TerminalProviders.GetLaunchSpec("gemini", "/plugin", NullLogger.Instance));
    }

    [Theory]
    [InlineData(TerminalProviders.Claude, "/jobpilot:pilot")]
    [InlineData(TerminalProviders.Codex, "$pilot")]
    public void FormatSkillCommand_UsesTheProvidersInvocationSyntax(string provider, string expected)
    {
        Assert.Equal(expected, TerminalProviders.FormatSkillCommand(provider, "pilot"));
    }

    [Theory]
    [InlineData(TerminalProviders.Claude, "/jobpilot:setup --force")]
    [InlineData(TerminalProviders.Codex, "$setup --force")]
    public void FormatSkillCommand_AppendsTrimmedArgs(string provider, string expected)
    {
        Assert.Equal(expected, TerminalProviders.FormatSkillCommand(provider, "setup", "  --force  "));
    }

    [Fact]
    public void FormatSkillCommand_Throws_ForAnUnknownProvider()
    {
        Assert.Throws<ArgumentException>(() => TerminalProviders.FormatSkillCommand("gemini", "pilot"));
    }
}

using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Tests.Support;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests.Providers;

public class ProviderTests
{
    [Theory]
    [InlineData(null, "claude")]
    [InlineData("   ", "claude")]
    [InlineData("  Claude  ", "claude")]
    [InlineData("CoDeX", "codex")]
    public void Parse_IsCaseInsensitive_AndDefaultsToClaude(string? id, string expected)
    {
        Assert.Equal(expected, Provider.Parse(id).Id);
    }

    [Theory]
    [InlineData("gemini")]
    [InlineData("claude-code")]
    public void Parse_Throws_ForAnUnknownProvider(string id)
    {
        Assert.Throws<ArgumentException>(() => Provider.Parse(id));
    }

    [Fact]
    public void Claude_StartsInAutoModeWithTheShippedSettings()
    {
        using var temp = new TempDir();
        var settings = temp.File(Path.Combine("settings", "claude.json"), """{"model":"sonnet"}""");

        Assert.Equal(
            ["--permission-mode", "auto", "--settings", settings, "--plugin-dir", temp.Root],
            Provider.Claude.BuildArgs(temp.Root, NullLogger.Instance));
    }

    [Fact]
    public void Claude_StaysLaunchable_WithoutASettingsFile()
    {
        using var temp = new TempDir();

        Assert.Equal(
            ["--permission-mode", "auto", "--plugin-dir", temp.Root],
            Provider.Claude.BuildArgs(temp.Root, NullLogger.Instance));
    }

    [Fact]
    public void Codex_ExpandsEveryConfigOverrideIntoADashC()
    {
        using var temp = new TempDir();
        temp.File(Path.Combine("settings", "codex.json"), """{"configOverrides":["a=1","b=\"two\""]}""");

        Assert.Equal(
            ["--no-alt-screen", "--approve-for-me", "-c", "a=1", "-c", "b=\"two\""],
            Provider.Codex.BuildArgs(temp.Root, NullLogger.Instance));
    }

    [Theory]
    [InlineData("claude", "/jobpilot:pilot")]
    [InlineData("codex", "$pilot")]
    public void SkillCommand_UsesTheProvidersInvocationSyntax(string id, string expected)
    {
        Assert.Equal(expected, Provider.Parse(id).SkillCommand("pilot"));
    }

    [Theory]
    [InlineData("claude", "/jobpilot:pilot", 1)]
    [InlineData("codex", "$pilot", 2)]
    [InlineData("codex", "Checking in", 1)]
    public void SubmitKeyPresses_AcceptsCodexAutocompleteFirst(string id, string command, int expected)
    {
        Assert.Equal(expected, Provider.Parse(id).SubmitKeyPresses(command));
    }
}

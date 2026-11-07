using System.Text.Json;
using JobPilot.Terminal.Pilot.Telemetry;
using Xunit;

namespace JobPilot.Terminal.Tests.Pilot.Telemetry;

public sealed class StepLabelsTests
{
    // Attribute values as both CLIs send them: OTLP stringValue, with JSON arguments inside a string.
    private static Dictionary<string, JsonElement> Record(params (string Key, string Text)[] attributes) =>
        attributes.ToDictionary(
            a => a.Key,
            a => JsonDocument.Parse(JsonSerializer.Serialize(new Dictionary<string, string> { ["stringValue"] = a.Text })).RootElement);

    private static string? Claude(string tool, string input, string? parameters = null)
    {
        List<(string, string)> attributes = [("event.name", "tool_result"), ("tool_name", tool), ("tool_input", input)];
        if (parameters is not null)
        {
            attributes.Add(("tool_parameters", parameters));
        }

        return StepLabels.ToolCallIn(Record([.. attributes])) is { } call ? StepLabels.Label(call) : null;
    }

    private static string? Codex(string tool, string arguments) =>
        StepLabels.ToolCallIn(Record(("event.name", "codex.tool_result"), ("tool_name", tool), ("arguments", arguments))) is { } call
            ? StepLabels.Label(call)
            : null;

    private static string? Bash(string command) => Claude("Bash", JsonSerializer.Serialize(new Dictionary<string, string> { ["command"] = command }));

    [Fact]
    public void Navigate_ShowsHostAndPath_NeverTheQuery()
    {
        var label = Claude(
            "mcp_tool",
            """{"url":"https://www.boards.greenhouse.io/acme/jobs/42?token=secret#apply"}""",
            """{"mcp_server_name":"playwright","mcp_tool_name":"browser_navigate"}""");

        Assert.Equal("Opened boards.greenhouse.io/acme/jobs/42", label);
    }

    [Fact]
    public void FormTools_NeverShowTypedValues()
    {
        Assert.Equal("Filled 3 fields", Codex("mcp__playwright__browser_fill_form", """{"fields":[{"value":"a"},{"value":"b"},{"value":"c"}]}"""));
        Assert.Equal("Typed into Email textbox", Codex("browser_type", """{"element":"Email textbox","text":"me@example.com"}"""));
        Assert.Equal("Clicked Submit application", Codex("browser_click", """{"element":"Submit application","ref":"e12"}"""));
    }

    [Theory]
    [InlineData("jobpilot-api POST /api/pilot/runs/r1/result -d '{\"outcome\":\"done\"}'", "Posted the result")]
    [InlineData("\"$CLAUDE_PLUGIN_ROOT/bin/jobpilot-api\" PATCH /api/feeds/$CID/jobs/$KEY --data @job.json", "Updated a job")]
    [InlineData("jobpilot-api GET '/api/credentials/resolve?domain=acme.com'", "Looked up a saved login")]
    [InlineData("jobpilot-api GET /api/user/profile", "Read from JobPilot")]
    public void ApiCalls_GetTheirRouteLabel(string command, string label) =>
        Assert.Equal(label, Bash(command));

    [Fact]
    public void Heartbeats_AndInternalTools_AreNotSteps()
    {
        Assert.Null(Bash("jobpilot-api POST /api/pilot/runs/r1/heartbeat"));
        Assert.Null(Claude("ToolSearch", """{"query":"select:x"}"""));
    }

    [Fact]
    public void OtherCommands_ShowOnlyTheProgram()
    {
        Assert.Equal("Ran curl", Bash("API_KEY=abc curl -H 'Authorization: Bearer abc' https://x.test"));
        Assert.Equal("Ran git", Codex("shell", """{"command":["bash","-lc","git status --short"]}"""));
    }

    [Fact]
    public void Subagents_ShowTheirName()
    {
        Assert.Equal("Started job-applier", Claude("Agent", """{"subagent_type":"job-applier","prompt":"apply to the job"}"""));
    }

    [Fact]
    public void CodexCodeModeWrapper_IsSkipped_BecauseItsCallsReportOnTheirOwn() =>
        Assert.Null(StepLabels.ToolCallIn(Record(("event.name", "codex.tool_result"), ("tool_name", "exec"), ("arguments", "text(1)"))));
}

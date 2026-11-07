using System.Text.Json;
using JobPilot.Terminal.Pilot.Telemetry;
using Xunit;

namespace JobPilot.Terminal.Tests.Pilot.Telemetry;

public sealed class UsageMeterTests
{
    private static JsonElement Export(params string[] records) =>
        JsonDocument.Parse($$"""{"resourceLogs":[{"scopeLogs":[{"logRecords":[{{string.Join(",", records)}}]}]}]}""").RootElement;

    private static string Record(params (string Key, string Value)[] attributes) =>
        $$"""{"attributes":[{{string.Join(",", attributes.Select(a => $$"""{"key":"{{a.Key}}","value":{{a.Value}}}"""))}}]}""";

    [Fact]
    public void Read_SumsClaudeRequests_AndIgnoresOtherEvents()
    {
        var meter = new UsageMeter();
        meter.Start();
        var request = Record(
            ("event.name", """{"stringValue":"api_request"}"""),
            ("model", """{"stringValue":"claude-sonnet-5"}"""),
            ("input_tokens", """{"intValue":2}"""),
            ("output_tokens", """{"intValue":160}"""),
            ("cache_read_tokens", """{"intValue":"65000"}"""),
            ("cache_creation_tokens", """{"intValue":300}"""));
        var other = Record(("event.name", """{"stringValue":"tool_result"}"""), ("input_tokens", """{"intValue":999}"""));

        meter.Read(Export(request, other, request));

        Assert.Equal(new PilotUsage("claude-sonnet-5", 4, 320, 130000, 600), meter.Take());
        Assert.Null(meter.Take());
    }

    [Fact]
    public void Read_SplitsCodexCachedTokensOutOfItsInputCount()
    {
        var meter = new UsageMeter();
        meter.Start();

        meter.Read(Export(
            Record(
                ("event.name", """{"stringValue":"codex.sse_event"}"""),
                ("event.kind", """{"stringValue":"response.completed"}"""),
                ("model", """{"stringValue":"gpt-6-sol"}"""),
                ("input_token_count", """{"stringValue":"15424"}"""),
                ("output_token_count", """{"stringValue":"5"}"""),
                ("cached_token_count", """{"intValue":"12032"}"""),
                ("cache_write_token_count", """{"intValue":"0"}""")),
            Record(("event.name", """{"stringValue":"codex.sse_event"}"""), ("event.kind", """{"stringValue":"response.created"}"""))));

        Assert.Equal(new PilotUsage("gpt-6-sol", 3392, 5, 12032, 0), meter.Take());
    }

    [Fact]
    public void Start_DropsUsageFromBeforeTheCycle()
    {
        var meter = new UsageMeter();
        meter.Read(Export(Record(("event.name", """{"stringValue":"api_request"}"""), ("output_tokens", """{"intValue":10}"""))));

        meter.Start();

        Assert.Null(meter.Take());
    }
}

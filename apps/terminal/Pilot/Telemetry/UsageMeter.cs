using System.Text.Json;
using JobPilot.Terminal.Pilot.Api;
using static JobPilot.Terminal.Pilot.Telemetry.OtlpLogs;

namespace JobPilot.Terminal.Pilot.Telemetry;

/// <summary>Sums the per-request usage both provider CLIs export to the host's OTLP/HTTP JSON logs endpoint.</summary>
public sealed class UsageMeter
{
    private readonly Lock sync = new();
    private PilotUsage? total;

    /// <summary>Drops what came before, such as the user's own session between cycles.</summary>
    public void Start()
    {
        lock (sync)
        {
            total = null;
        }
    }

    /// <summary>Null when no request was measured since <see cref="Start"/>.</summary>
    public PilotUsage? Take()
    {
        lock (sync)
        {
            var usage = total;
            total = null;
            return usage;
        }
    }

    public void Read(JsonElement export)
    {
        foreach (var attributes in OtlpLogs.Records(export))
        {
            var name = Text(attributes, "event.name");
            if (name == "api_request")
            {
                Add(
                    Text(attributes, "model"),
                    Number(attributes, "input_tokens"),
                    Number(attributes, "output_tokens"),
                    Number(attributes, "cache_read_tokens"),
                    Number(attributes, "cache_creation_tokens"));
            }
            else if (name == "codex.sse_event" && Text(attributes, "event.kind") == "response.completed")
            {
                // Codex counts cached tokens inside its input count; Claude reports them apart.
                var cached = Number(attributes, "cached_token_count");
                Add(
                    Text(attributes, "model"),
                    Number(attributes, "input_token_count") - cached,
                    Number(attributes, "output_token_count"),
                    cached,
                    Number(attributes, "cache_write_token_count"));
            }
        }
    }

    private void Add(string? model, long input, long output, long cacheRead, long cacheWrite)
    {
        lock (sync)
        {
            total = new PilotUsage(
                model ?? total?.Model ?? "unknown",
                (total?.InputTokens ?? 0) + input,
                (total?.OutputTokens ?? 0) + output,
                (total?.CacheReadTokens ?? 0) + cacheRead,
                (total?.CacheWriteTokens ?? 0) + cacheWrite);
        }
    }
}

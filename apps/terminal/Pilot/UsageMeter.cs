using System.Text.Json;
using static JobPilot.Terminal.Pilot.OtlpLogs;

namespace JobPilot.Terminal.Pilot;

/// <summary>POST /api/pilot/runs/:id/usage: one run's token usage.</summary>
public sealed record PilotUsage(
    string Model, long InputTokens, long OutputTokens, long CacheReadTokens, long CacheWriteTokens);

/// <summary>Sums the per-request usage both provider CLIs export to the host's OTLP/HTTP JSON logs endpoint.</summary>
public sealed class UsageMeter
{
    private readonly Lock sync = new();
    private string? model;
    private long input;
    private long output;
    private long cacheRead;
    private long cacheWrite;

    /// <summary>Drops what came before, such as the user's own session between cycles.</summary>
    public void Start()
    {
        lock (sync)
        {
            Reset();
        }
    }

    /// <summary>Null when no request was measured since <see cref="Start"/>.</summary>
    public PilotUsage? Take()
    {
        lock (sync)
        {
            if (model is null)
            {
                return null;
            }

            var usage = new PilotUsage(model, input, output, cacheRead, cacheWrite);
            Reset();
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

    private void Reset()
    {
        model = null;
        input = output = cacheRead = cacheWrite = 0;
    }

    private void Add(string? requestModel, long requestInput, long requestOutput, long requestCacheRead, long requestCacheWrite)
    {
        lock (sync)
        {
            model = requestModel ?? model ?? "unknown";
            input += requestInput;
            output += requestOutput;
            cacheRead += requestCacheRead;
            cacheWrite += requestCacheWrite;
        }
    }
}

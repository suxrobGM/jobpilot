using System.Globalization;
using System.Text.Json;

namespace JobPilot.Terminal.Pilot;

/// <summary>Reads the OTLP/HTTP JSON log exports both provider CLIs post to the host.</summary>
internal static class OtlpLogs
{
    /// <summary>Each log record's attributes, keyed by name.</summary>
    public static IEnumerable<Dictionary<string, JsonElement>> Records(JsonElement export) =>
        from resource in Array(export, "resourceLogs")
        from scope in Array(resource, "scopeLogs")
        from record in Array(scope, "logRecords")
        select Attributes(record);

    public static string? Text(Dictionary<string, JsonElement> attributes, string key) =>
        attributes.TryGetValue(key, out var value) && value.TryGetProperty("stringValue", out var text) ? text.GetString() : null;

    // OTLP JSON allows an int as a number or a string, and Codex sends some counts as stringValue.
    public static long Number(Dictionary<string, JsonElement> attributes, string key)
    {
        if (!attributes.TryGetValue(key, out var value))
        {
            return 0;
        }

        foreach (var property in value.EnumerateObject())
        {
            var raw = property.Value;
            var text = raw.ValueKind == JsonValueKind.String ? raw.GetString() : raw.GetRawText();
            if (long.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var number))
            {
                return number;
            }
        }

        return 0;
    }

    private static IEnumerable<JsonElement> Array(JsonElement parent, string name) =>
        parent.ValueKind == JsonValueKind.Object && parent.TryGetProperty(name, out var array) && array.ValueKind == JsonValueKind.Array
            ? array.EnumerateArray()
            : [];

    private static Dictionary<string, JsonElement> Attributes(JsonElement record)
    {
        Dictionary<string, JsonElement> attributes = [];
        foreach (var attribute in Array(record, "attributes"))
        {
            if (attribute.TryGetProperty("key", out var key) && attribute.TryGetProperty("value", out var value))
            {
                attributes[key.GetString() ?? ""] = value;
            }
        }

        return attributes;
    }
}

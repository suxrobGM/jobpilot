using System.Text.Json;
using JobPilot.Terminal.Hosting;

namespace JobPilot.Terminal.Providers.Codex;

internal static class Toml
{
    // JSON string escapes are a subset of TOML basic-string escapes, so the serializer doubles as the TOML quoter.
    public static string String(string value) => JsonSerializer.Serialize(value, AppJsonContext.Default.String);

    // Literal strings keep the checked-in agent files readable. Text a literal cannot hold (a `'''` run, a
    // control character, a leading or trailing quote) falls back to the escaped form.
    public static string ReadableString(string value)
    {
        var needsEscapes = value.Contains("'''") || value.StartsWith('\'') || value.EndsWith('\'')
            || value.Any(c => char.IsControl(c) && c is not '\n' and not '\t');
        if (needsEscapes)
        {
            return String(value);
        }

        if (value.Contains('\n'))
        {
            return $"'''\n{value}'''";
        }

        return value.Contains('\'') ? $"'''{value}'''" : $"'{value}'";
    }
}

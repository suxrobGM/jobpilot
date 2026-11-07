namespace JobPilot.Terminal.Providers.Codex;

/// <summary>
/// A Claude agent file as a Codex agent, with its body inlined so the prompt cache can reuse it. Codex agents take
/// no tool list and inherit the session model, so only the name and description carry over.
/// </summary>
internal static class CodexAgentToml
{
    /// <summary>Null unless the frontmatter has both a name and a description.</summary>
    public static string? From(string markdown)
    {
        var lines = markdown.ReplaceLineEndings("\n").Split('\n');
        var end = lines.Length > 0 && lines[0] == "---" ? Array.IndexOf(lines, "---", 1) : -1;
        if (end < 0)
        {
            return null;
        }

        var fields = FrontmatterFields(lines[1..end]);
        if (!fields.TryGetValue("name", out var name) || !fields.TryGetValue("description", out var description))
        {
            return null;
        }

        var body = string.Join('\n', lines[(end + 1)..]).Trim();
        return $"name = {Toml.ReadableString(name)}\ndescription = {Toml.ReadableString(description)}\n"
            + $"developer_instructions = {Toml.ReadableString(body)}\n";
    }

    // Only the YAML the agent files use: `key: value`, or a folded `key: >-` with indented lines.
    private static Dictionary<string, string> FrontmatterFields(string[] lines)
    {
        Dictionary<string, string> fields = [];
        string? key = null;
        foreach (var line in lines)
        {
            if (key is not null && line.StartsWith(' '))
            {
                fields[key] = $"{fields[key]} {line.Trim()}".Trim();
                continue;
            }

            var colon = line.IndexOf(':');
            if (colon <= 0)
            {
                key = null;
                continue;
            }

            key = line[..colon].Trim();
            var value = line[(colon + 1)..].Trim();
            fields[key] = value is ">-" or ">" ? "" : value.Trim('"');
        }

        return fields;
    }
}

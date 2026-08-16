using System.Text.Json;
using System.Text.Json.Serialization.Metadata;

namespace JobPilot.Terminal.Hosting;

/// <summary>Shape of plugin/settings/codex.json.</summary>
/// <param name="ConfigOverrides">Codex `-c` values, in TOML value syntax.</param>
public sealed record CodexSettingsFile(string[]? ConfigOverrides);

/// <summary>Provider-neutral MCP configuration shipped at the plugin root.</summary>
/// <param name="McpServers">Named STDIO servers exposed by the plugin.</param>
public sealed record PluginMcpFile(Dictionary<string, PluginMcpServer>? McpServers);

/// <summary>A bundled STDIO MCP server.</summary>
/// <param name="Command">Executable that starts the server.</param>
/// <param name="Args">Arguments passed to the executable.</param>
public sealed record PluginMcpServer(string? Command, string[]? Args);

/// <summary>Config shipped with the plugin (settings/*.json and the root .mcp.json); a missing or unreadable file warns and the launch goes on without it.</summary>
public static class AgentSettings
{
    /// <summary>Path for `claude --settings`, or null when the file is absent.</summary>
    public static string? ClaudeSettingsFile(string pluginDir, ILogger logger)
    {
        var path = SettingsPath(pluginDir, "claude.json");
        if (File.Exists(path))
        {
            return path;
        }

        logger.LogWarning(
            "Claude settings file missing at {Path}; the session starts without the shipped model, deny list, and auto-mode context.",
            path);
        return null;
    }

    /// <summary>Values expanded into repeated `codex -c` arguments.</summary>
    public static string[] CodexConfigOverrides(string pluginDir, ILogger logger) =>
        [.. ReadCodexSettings(pluginDir, logger), .. ReadMcpOverrides(pluginDir, logger)];

    private static string[] ReadCodexSettings(string pluginDir, ILogger logger)
    {
        var parsed = ReadJson(
            SettingsPath(pluginDir, "codex.json"),
            AppJsonContext.Default.CodexSettingsFile,
            logger,
            "the session starts with no config overrides");
        return parsed?.ConfigOverrides ?? [];
    }

    private static List<string> ReadMcpOverrides(string pluginDir, ILogger logger)
    {
        var parsed = ReadJson(
            Path.Combine(pluginDir, ".mcp.json"),
            AppJsonContext.Default.PluginMcpFile,
            logger,
            "Codex starts without bundled browser tools");

        List<string> overrides = [];
        foreach (var (name, server) in parsed?.McpServers ?? [])
        {
            if (string.IsNullOrWhiteSpace(server.Command))
            {
                logger.LogWarning("Plugin MCP server {Server} has no command and will not be loaded by Codex.", name);
                continue;
            }

            var key = TomlString(name);
            overrides.Add($"mcp_servers.{key}.command={TomlString(server.Command)}");
            if (server.Args is { } args)
            {
                overrides.Add($"mcp_servers.{key}.args=[{string.Join(',', args.Select(TomlString))}]");
            }
        }

        return overrides;
    }

    private static T? ReadJson<T>(string path, JsonTypeInfo<T> typeInfo, ILogger logger, string consequence)
        where T : class
    {
        if (!File.Exists(path))
        {
            logger.LogWarning("Plugin file missing at {Path}; {Consequence}.", path, consequence);
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize(File.ReadAllText(path), typeInfo);
        }
        catch (Exception ex) when (ex is JsonException or IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(ex, "Could not read plugin file at {Path}; {Consequence}.", path, consequence);
            return null;
        }
    }

    // JSON string escapes are a subset of TOML basic-string escapes, so the serializer doubles as the TOML quoter.
    private static string TomlString(string value) =>
        JsonSerializer.Serialize(value, AppJsonContext.Default.String);

    private static string SettingsPath(string pluginDir, string fileName) =>
        Path.Combine(pluginDir, "settings", fileName);
}

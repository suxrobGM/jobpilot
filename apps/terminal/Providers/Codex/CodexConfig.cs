using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using System.Text.RegularExpressions;
using JobPilot.Terminal.Hosting;

namespace JobPilot.Terminal.Providers.Codex;

/// <summary>Shape of plugin/settings/codex.json. Overrides are Codex `-c` values in TOML syntax.</summary>
public sealed record CodexSettingsFile(string[]? ConfigOverrides);

/// <summary>Shape of the plugin's .mcp.json.</summary>
public sealed record PluginMcpFile(Dictionary<string, PluginMcpServer>? McpServers);

/// <summary>A STDIO server when it has a command, a remote HTTP server when it has a URL.</summary>
public sealed record PluginMcpServer(string? Command, string[]? Args, string? Url);

/// <summary>Codex has no --settings flag, so the shipped config and MCP servers arrive as repeated -c overrides.</summary>
internal static partial class CodexConfig
{
    // npx fetches @playwright/mcp on first launch, which outruns Codex's default startup window.
    private const int McpStartupTimeoutSeconds = 120;

    /// <summary>codex.json overrides followed by the bundled MCP servers; a missing or bad file is skipped with a warning.</summary>
    public static string[] Overrides(string pluginDir, ILogger logger, Func<string, string?> resolveExecutable)
    {
        var settings = ReadJson(
            Path.Combine(pluginDir, "settings", "codex.json"),
            AppJsonContext.Default.CodexSettingsFile,
            logger,
            "the session starts with no config overrides");
        var mcp = ReadJson(
            Path.Combine(pluginDir, ".mcp.json"),
            AppJsonContext.Default.PluginMcpFile,
            logger,
            "Codex starts without bundled browser tools");

        List<string> overrides = [.. settings?.ConfigOverrides ?? []];
        foreach (var (name, server) in mcp?.McpServers ?? [])
        {
            overrides.AddRange(McpOverrides(name, server, logger, resolveExecutable));
        }

        return [.. overrides];
    }

    private static IEnumerable<string> McpOverrides(
        string name, PluginMcpServer server, ILogger logger, Func<string, string?> resolveExecutable)
    {
        // Codex reads the -c key path literally, so the name must already be a bare TOML key.
        if (!BareTomlKey().IsMatch(name))
        {
            logger.LogWarning("Plugin MCP server {Server} has a name Codex rejects and will not be loaded.", name);
            return [];
        }

        if (!string.IsNullOrWhiteSpace(server.Url))
        {
            return [$"mcp_servers.{name}.url={Toml.String(server.Url)}"];
        }

        if (string.IsNullOrWhiteSpace(server.Command))
        {
            logger.LogWarning("Plugin MCP server {Server} has neither a command nor a url and will not be loaded by Codex.", name);
            return [];
        }

        if (resolveExecutable(server.Command) is not { } executable)
        {
            logger.LogError(
                "Plugin MCP server {Server} command {Command} is not on PATH; Codex sessions start without browser tools.",
                name,
                server.Command);
            return [];
        }

        // Codex spawns the server directly, and CreateProcess cannot run a .cmd shim.
        var needsShell = ExecutablePath.NeedsShell(executable);
        var command = needsShell ? "cmd.exe" : executable;
        string[] args = needsShell ? ["/c", executable, .. server.Args ?? []] : server.Args ?? [];

        List<string> overrides = [$"mcp_servers.{name}.command={Toml.String(command)}"];
        if (args.Length > 0)
        {
            overrides.Add($"mcp_servers.{name}.args=[{string.Join(',', args.Select(Toml.String))}]");
        }

        overrides.Add($"mcp_servers.{name}.startup_timeout_sec={McpStartupTimeoutSeconds}");
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

    [GeneratedRegex("^[a-zA-Z0-9_-]+$")]
    private static partial Regex BareTomlKey();
}

using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using System.Text.RegularExpressions;
using JobPilot.Terminal.Common;
using JobPilot.Terminal.Hosting;

namespace JobPilot.Terminal.Providers;

/// <summary>Shape of plugin/settings/codex.json. Overrides are Codex `-c` values in TOML syntax.</summary>
public sealed record CodexSettingsFile(string[]? ConfigOverrides);

/// <summary>Shape of the plugin's .mcp.json.</summary>
public sealed record PluginMcpFile(Dictionary<string, PluginMcpServer>? McpServers);

/// <summary>A STDIO server when it has a command, a remote HTTP server when it has a URL.</summary>
public sealed record PluginMcpServer(string? Command, string[]? Args, string? Url);

internal sealed partial class CodexProvider : Provider
{
    private const string SkillPrefix = "$";

    // The marketplace plugin owns the setup bootstrap, so the workspace copy leaves it out.
    private const string BootstrapSkill = "setup";

    // npx fetches @playwright/mcp on first launch, which outruns Codex's default startup window.
    private const int McpStartupTimeoutSeconds = 120;

    public override string Id => "codex";

    public override string DisplayName => "Codex";

    public override string Command => "codex";

    // Codex has no --settings flag, so shipped config arrives as repeated -c overrides. The PTY already sets
    // the cwd; repeating it through -C makes Windows paths cross a second argument parser.
    public override string[] BuildArgs(string pluginDir, ILogger logger) =>
        ["--no-alt-screen", "--approve-for-me", .. ConfigOverrides(pluginDir, logger, ExecutablePath.Find).SelectMany(o => new[] { "-c", o })];

    /// <summary>Codex discovers skills from .agents/skills and agents from .codex/agents, both wholly ours to rebuild.</summary>
    public override void PrepareWorkspace(InstallPaths paths)
    {
        var target = Path.Combine(paths.WorkingDir, ".agents", "skills");
        FileTree.DeleteIfExists(target);
        FileTree.Copy(paths.SkillsDir, target);
        FileTree.DeleteIfExists(Path.Combine(target, BootstrapSkill));

        var agents = Path.Combine(paths.WorkingDir, ".codex", "agents");
        FileTree.DeleteIfExists(agents);
        Directory.CreateDirectory(agents);
        foreach (var source in Directory.EnumerateFiles(Path.Combine(paths.PluginDir, "agents"), "*.md"))
        {
            if (AgentToml(File.ReadAllText(source)) is { } toml)
            {
                File.WriteAllText(Path.Combine(agents, Path.GetFileNameWithoutExtension(source) + ".toml"), toml);
            }
        }
    }

    /// <summary>
    /// A Claude agent file as a Codex agent, with its body inlined so the prompt cache can reuse it. Codex agents take
    /// no tool list and inherit the session model, so only the name and description carry over. Null without both.
    /// </summary>
    internal static string? AgentToml(string markdown)
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
        return $"name = {ReadableTomlString(name)}\ndescription = {ReadableTomlString(description)}\n"
            + $"developer_instructions = {ReadableTomlString(body)}\n";
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

    public override string SkillCommand(string skill) => SkillPrefix + skill;

    // The first Enter only accepts the selected $skill autocomplete item.
    public override int SubmitKeyPresses(string command) =>
        command.StartsWith(SkillPrefix, StringComparison.Ordinal) ? 2 : 1;

    /// <summary>codex.json overrides followed by the bundled MCP servers; a missing or bad file is skipped with a warning.</summary>
    internal static string[] ConfigOverrides(string pluginDir, ILogger logger, Func<string, string?> resolveExecutable)
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
            return [$"mcp_servers.{name}.url={TomlString(server.Url)}"];
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

        List<string> overrides = [$"mcp_servers.{name}.command={TomlString(command)}"];
        if (args.Length > 0)
        {
            overrides.Add($"mcp_servers.{name}.args=[{string.Join(',', args.Select(TomlString))}]");
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

    // JSON string escapes are a subset of TOML basic-string escapes, so the serializer doubles as the TOML quoter.
    private static string TomlString(string value) => JsonSerializer.Serialize(value, AppJsonContext.Default.String);

    // Literal strings keep the checked-in agent files readable. Text a literal cannot hold (a `'''` run, a
    // control character, a leading or trailing quote) falls back to the escaped form.
    private static string ReadableTomlString(string value)
    {
        var needsEscapes = value.Contains("'''") || value.StartsWith('\'') || value.EndsWith('\'')
            || value.Any(c => char.IsControl(c) && c is not '\n' and not '\t');
        if (needsEscapes)
        {
            return TomlString(value);
        }

        if (value.Contains('\n'))
        {
            return $"'''\n{value}'''";
        }

        return value.Contains('\'') ? $"'''{value}'''" : $"'{value}'";
    }

    [GeneratedRegex("^[a-zA-Z0-9_-]+$")]
    private static partial Regex BareTomlKey();
}

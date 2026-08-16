using System.Text.Json;

namespace JobPilot.Terminal.Hosting;

/// <summary>Shape of plugin/settings/codex.json.</summary>
/// <param name="ConfigOverrides">Codex `-c` values, in TOML value syntax.</param>
public sealed record CodexSettingsFile(string[]? ConfigOverrides);

/// <summary>Provider config shipped under the plugin's settings/ folder; a missing or unreadable file warns and the launch goes on without it.</summary>
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
    public static string[] CodexConfigOverrides(string pluginDir, ILogger logger)
    {
        var path = SettingsPath(pluginDir, "codex.json");
        if (!File.Exists(path))
        {
            logger.LogWarning("Codex settings file missing at {Path}; the session starts with no config overrides.", path);
            return [];
        }

        try
        {
            var parsed = JsonSerializer.Deserialize(File.ReadAllText(path), AppJsonContext.Default.CodexSettingsFile);
            return parsed?.ConfigOverrides ?? [];
        }
        catch (Exception ex) when (ex is JsonException or IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(ex, "Could not read Codex settings at {Path}; the session starts with no config overrides.", path);
            return [];
        }
    }

    private static string SettingsPath(string pluginDir, string fileName) =>
        Path.Combine(pluginDir, "settings", fileName);
}

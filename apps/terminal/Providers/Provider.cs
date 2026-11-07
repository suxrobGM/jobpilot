using JobPilot.Terminal.Install;
using JobPilot.Terminal.Providers.Codex;

namespace JobPilot.Terminal.Providers;

public sealed record ProviderInfo(string Id, string DisplayName);

/// <summary>An agent CLI the host can launch. Defaults describe Claude Code; Codex overrides its quirks.</summary>
public abstract class Provider
{
    public static readonly Provider Claude = new ClaudeProvider();
    public static readonly Provider Codex = new CodexProvider();

    public static readonly Provider[] All = [Claude, Codex];

    public abstract string Id { get; }

    public abstract string DisplayName { get; }

    /// <summary>Executable to spawn.</summary>
    public abstract string Executable { get; }

    public ProviderInfo Info => new(Id, DisplayName);

    /// <summary>Resolves an id case-insensitively; a blank id means Claude.</summary>
    /// <exception cref="ArgumentException">The id is not a known provider.</exception>
    public static Provider Parse(string? id)
    {
        var trimmed = id?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return Claude;
        }

        return All.FirstOrDefault(p => p.Id.Equals(trimmed, StringComparison.OrdinalIgnoreCase))
            ?? throw new ArgumentException($"Unsupported terminal provider '{id}'.");
    }

    /// <summary>Launch arguments, reading the provider's shipped settings from the plugin dir.</summary>
    public abstract string[] BuildArgs(string pluginDir, ILogger logger);

    /// <summary>Runs before the outgoing session stops, so a failure here leaves that session alive.</summary>
    public virtual void PrepareWorkspace(InstallPaths paths)
    {
    }

    /// <summary>Mirrors the web's formatSkillCommand.</summary>
    public virtual string SkillCommand(string skill) => $"/jobpilot:{skill}";

    public virtual int SubmitKeyPresses(string command) => 1;
}

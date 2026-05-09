namespace JobPilot.Terminal.Models;

/// <summary>
/// Supported AI terminal providers.
/// </summary>
public static class TerminalProviders
{
    public const string Claude = "claude";
    public const string Codex = "codex";

    public static string Normalize(string? provider)
    {
        return provider?.Trim().ToLowerInvariant() switch
        {
            null or "" => Claude,
            Claude => Claude,
            Codex => Codex,
            _ => throw new ArgumentException($"Unsupported terminal provider '{provider}'.")
        };
    }
}

/// <summary>
/// User-facing provider metadata returned to the web app.
/// </summary>
/// <param name="Id">Stable provider id used by API requests.</param>
/// <param name="DisplayName">Label shown in the terminal UI.</param>
public sealed record TerminalProviderInfo(string Id, string DisplayName);

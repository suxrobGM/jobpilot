using JobPilot.Terminal;

namespace JobPilot.Terminal.Models;

/// <summary>
/// Health and lifecycle status returned by terminal session endpoints.
/// </summary>
public sealed record SessionStatus
{
    /// <summary>API status value, usually <c>ok</c>; <c>degraded</c> when the host runs but can't start sessions.</summary>
    public required string Status { get; init; }

    /// <summary>Current terminal session state (<c>running</c> / <c>stopped</c>).</summary>
    public required string Session { get; init; }

    /// <summary>Current or last requested terminal provider.</summary>
    public required string Provider { get; init; }

    /// <summary>Supported provider metadata for clients.</summary>
    public required TerminalProviderInfo[] Providers { get; init; }

    /// <summary>The host binary version. The dashboard compares it to the latest terminal release to prompt a
    /// re-install; the plugin self-updates at startup, so it is not here.</summary>
    public required string HostVersion { get; init; }

    /// <summary>Human-readable reason when <see cref="Status"/> is <c>degraded</c>.</summary>
    public string? Detail { get; init; }

    /// <summary>True when the <c>jobpilot://</c> scheme is registered, so the dashboard can offer a one-click
    /// relaunch when the host is offline.</summary>
    public bool CanRelaunch { get; init; }
}

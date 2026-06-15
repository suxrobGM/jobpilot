using JobPilot.Terminal;

namespace JobPilot.Terminal.Models;

/// <summary>
/// Health and lifecycle status returned by terminal session endpoints.
/// </summary>
/// <param name="Status">API status value, usually <c>ok</c>.</param>
/// <param name="Session">Current terminal session state.</param>
/// <param name="Provider">Current or last requested terminal provider.</param>
/// <param name="Providers">Supported provider metadata for clients.</param>
public sealed record SessionStatus(
    string Status,
    string Session,
    string Provider,
    TerminalProviderInfo[] Providers);

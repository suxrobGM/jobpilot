using JobPilot.Terminal.Install;
using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Sessions;

namespace JobPilot.Terminal.Hosting;

/// <summary>What /healthz and every control endpoint return.</summary>
public sealed record StatusResponse
{
    /// <summary><c>ok</c>, or <c>degraded</c> when the host runs but cannot start sessions, e.g. the plugin tree is missing.</summary>
    public required string Status { get; init; }

    /// <summary><c>running</c> or <c>stopped</c>.</summary>
    public required string Session { get; init; }

    /// <summary>The running or last started provider.</summary>
    public required string Provider { get; init; }

    public required ProviderInfo[] Providers { get; init; }

    public required string HostVersion { get; init; }

    /// <summary>Why the host is degraded.</summary>
    public string? Detail { get; init; }

    /// <summary>Whether the browser can relaunch the host through the jobpilot:// scheme.</summary>
    public bool CanRelaunch { get; init; }

    public bool CanUpdate { get; init; }

    public required PilotStatus Pilot { get; init; }
}

public sealed class HostStatus(TerminalSession session, HostInstall install, UrlScheme scheme, PilotLoop pilot)
{
    public StatusResponse Get() => new()
    {
        Status = install.PathsError is null ? "ok" : "degraded",
        Session = session.IsRunning ? "running" : "stopped",
        Provider = session.ActiveProvider.Id,
        Providers = Provider.All,
        HostVersion = HostInstall.HostVersion,
        Detail = install.PathsError,
        CanRelaunch = scheme.IsRegistered,
        CanUpdate = install.CanUpdate,
        Pilot = pilot.GetStatus(),
    };
}

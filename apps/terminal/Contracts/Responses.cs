namespace JobPilot.Terminal.Contracts;

/// <summary>Terminal host and session status.</summary>
public sealed record SessionStatus
{
    /// <summary>The host runs and can start sessions.</summary>
    public const string StatusOk = "ok";

    /// <summary>The host runs but cannot start sessions, e.g. the plugin tree is missing.</summary>
    public const string StatusDegraded = "degraded";

    public const string SessionRunning = "running";
    public const string SessionStopped = "stopped";

    /// <summary>API status value: <see cref="StatusOk"/> or <see cref="StatusDegraded"/>.</summary>
    public required string Status { get; init; }

    /// <summary>Current terminal session state: <see cref="SessionRunning"/> or <see cref="SessionStopped"/>.</summary>
    public required string Session { get; init; }

    /// <summary>Current or last requested terminal provider.</summary>
    public required string Provider { get; init; }

    /// <summary>Supported provider metadata for clients.</summary>
    public required TerminalProviderInfo[] Providers { get; init; }

    /// <summary>Host binary version.</summary>
    public required string HostVersion { get; init; }

    /// <summary>Human-readable reason when <see cref="Status"/> is <see cref="StatusDegraded"/>.</summary>
    public string? Detail { get; init; }

    /// <summary>Whether the browser can relaunch the host.</summary>
    public bool CanRelaunch { get; init; }

    /// <summary>Whether this install supports self-update.</summary>
    public bool CanUpdate { get; init; }

    /// <summary>Pilot autonomous-mode state. Additive; absent on older hosts.</summary>
    public PilotStatus? Pilot { get; init; }
}

/// <summary>Autonomous pilot-mode status surfaced on /healthz.</summary>
public sealed record PilotStatus
{
    /// <summary>Whether the pilot loop is enabled.</summary>
    public required bool Enabled { get; init; }

    /// <summary>Whether a provider pairing is stored.</summary>
    public required bool Paired { get; init; }

    /// <summary>Whether the conductor is actively driving a session right now.</summary>
    public required bool Conducting { get; init; }

    /// <summary>When the last cycle sentinel was seen.</summary>
    public DateTimeOffset? LastCycleAt { get; init; }

    /// <summary>Last cycle outcome: <c>ok</c>, <c>empty</c>, or <c>error</c>.</summary>
    public string? LastCycleStatus { get; init; }

    /// <summary>Consecutive watchdog kills; reset by a completed cycle.</summary>
    public required int ConsecutiveTimeouts { get; init; }
}

/// <summary>Result of a runtime update request.</summary>
public sealed record UpdateResult
{
    public const string ReasonUpToDate = "up-to-date";
    public const string ReasonDevCheckout = "dev-checkout";
    public const string ReasonInProgress = "in-progress";
    public const string ReasonNoAsset = "no-asset";

    /// <summary>Whether an update was installed and relaunched.</summary>
    public required bool Updating { get; init; }

    /// <summary>Version running before the update.</summary>
    public required string FromVersion { get; init; }

    /// <summary>Version being launched, if any.</summary>
    public string? ToVersion { get; init; }

    /// <summary>Machine-readable reason when not updating.</summary>
    public string? Reason { get; init; }
}

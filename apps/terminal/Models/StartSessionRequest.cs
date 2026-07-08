namespace JobPilot.Terminal.Models;

/// <summary>
/// Request body used to start a terminal session with an initial viewport size.
/// </summary>
public sealed record StartSessionRequest
{
    /// <summary>Initial terminal column count.</summary>
    public int Cols { get; init; }

    /// <summary>Initial terminal row count.</summary>
    public int Rows { get; init; }

    /// <summary>Optional working directory for the terminal process.</summary>
    public string? WorkingDir { get; init; }

    /// <summary>Optional terminal provider id. Defaults to Claude.</summary>
    public string? Provider { get; init; }

    /// <summary>Optional per-user agent PAT, injected into the PTY as JOBPILOT_API_TOKEN.</summary>
    public string? ApiToken { get; init; }

    /// <summary>Optional web app origin (the browser's location), injected into the PTY as JOBPILOT_WEB for user-facing links.</summary>
    public string? WebUrl { get; init; }

    /// <summary>Optional backend base URL (the web app's configured API origin), injected into the PTY as
    /// JOBPILOT_API. Lets a hosted web point the local agent at the remote API instead of localhost.</summary>
    public string? ApiUrl { get; init; }
}

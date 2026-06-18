namespace JobPilot.Terminal.Models;

/// <summary>
/// Request body used to start a terminal session with an initial viewport size.
/// </summary>
/// <param name="Cols">Initial terminal column count.</param>
/// <param name="Rows">Initial terminal row count.</param>
/// <param name="WorkingDir">Optional working directory for the terminal process.</param>
/// <param name="Provider">Optional terminal provider id. Defaults to Claude.</param>
/// <param name="ApiToken">Optional per-user agent PAT, injected into the PTY as JOBPILOT_API_TOKEN.</param>
public sealed record StartSessionRequest(int Cols, int Rows, string? WorkingDir = null, string? Provider = null, string? ApiToken = null);

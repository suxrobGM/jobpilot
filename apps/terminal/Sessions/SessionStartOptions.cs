namespace JobPilot.Terminal.Sessions;

/// <summary>Inputs needed to launch one provider session.</summary>
public sealed record SessionStartOptions(
    string? Provider,
    int Cols,
    int Rows,
    string? ApiToken = null,
    string? ApiUrl = null,
    string? WebUrl = null);

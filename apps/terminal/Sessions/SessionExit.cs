namespace JobPilot.Terminal.Sessions;

/// <summary>Current session exit information.</summary>
public readonly record struct SessionExit(string ProviderDisplayName, int ExitCode, bool Requested);

using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Sessions;

namespace JobPilot.Terminal.Pilot;

public sealed record PilotPairing
{
    public required Provider Provider { get; init; }
    public required ApiConnection Api { get; init; }

    /// <summary>The account the host is paired to, so the web can tell a stale pairing from its own.</summary>
    public string? UserId { get; init; }
}

/// <summary>Shape of pilot.json. The token is DPAPI-wrapped on Windows and 0600 plaintext elsewhere.</summary>
internal sealed record PairingFile
{
    public required string Provider { get; init; }
    public required string ApiUrl { get; init; }
    public required string WebUrl { get; init; }
    public string? UserId { get; init; }
    public required string Token { get; init; }
    public required bool Protected { get; init; }
}

using JobPilot.Terminal.Pilot;

namespace JobPilot.Terminal.Tests;

internal static class TestPairing
{
    public static PilotPairing Create(bool enabled = true, string apiUrl = "https://api") => new()
    {
        Provider = "claude",
        ApiToken = "tok",
        ApiUrl = apiUrl,
        WebUrl = "https://web",
        Enabled = enabled,
    };
}

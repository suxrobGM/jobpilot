using JobPilot.Terminal.Pilot;

namespace JobPilot.Terminal.Tests;

internal static class TestPairing
{
    public static PilotPairing Create(
        bool running = true,
        string apiUrl = "https://api",
        string apiToken = "tok") => new()
        {
            Provider = "claude",
            ApiToken = apiToken,
            ApiUrl = apiUrl,
            WebUrl = "https://web",
            Running = running,
        };
}

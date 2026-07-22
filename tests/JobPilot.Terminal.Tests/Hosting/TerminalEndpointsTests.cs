using System.Text.Json;
using JobPilot.Terminal;
using JobPilot.Terminal.Contracts;
using JobPilot.Terminal.Hosting;
using JobPilot.Terminal.Pilot;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests;

public sealed class TerminalEndpointsTests
{
    // --- POST /pilot/start binds the pairing body the web sends and stores it as a running pairing ---

    [Fact]
    public void PilotStart_BindsTheBody_AndSavesARunningPairing()
    {
        // The /pilot/start route binds this exact envelope from the web, so a rename that broke the shape shows here.
        var request = JsonSerializer.Deserialize(
            """{"provider":"claude","apiToken":"tok","apiUrl":"https://api.example.test","webUrl":"https://web.example.test"}""",
            AppJsonContext.Default.PilotStartRequest);

        Assert.NotNull(request);
        Assert.Equal("claude", request!.Provider);
        Assert.Equal("tok", request.ApiToken);

        using var temp = new TempDir();
        var store = new PilotStore(Path.Combine(temp.Root, "pilot.json"), NullLogger<PilotStore>.Instance);

        // Mirror what the endpoint does on start: persist the pairing with Running=true.
        store.Save(new PilotPairing
        {
            Provider = request.Provider!,
            ApiToken = request.ApiToken!,
            ApiUrl = request.ApiUrl!,
            WebUrl = request.WebUrl!,
            Running = true,
        });

        Assert.True(store.Current is { Running: true });
    }

    // --- POST /pilot/stop keeps the pairing but flips it to not-running ---

    [Fact]
    public void PilotStop_KeepsThePairing_AndClearsRunning()
    {
        using var temp = new TempDir();
        var store = new PilotStore(Path.Combine(temp.Root, "pilot.json"), NullLogger<PilotStore>.Instance);
        store.Save(TestPairing.Create());

        // Mirror what the endpoint does on stop: the bodyless route flips the running flag but keeps the pairing.
        store.SetRunning(false);

        Assert.True(store.Current is { Running: false });
        Assert.Equal("tok", store.Current!.ApiToken); // pairing (and its token) is kept for a later restart
    }

    [Theory]
    [InlineData("https://api.example.test")]
    [InlineData("http://localhost:4101")]
    public void IsHttpUrl_AcceptsAbsoluteHttpUrls(string value)
    {
        Assert.True(TerminalEndpoints.IsHttpUrl(value));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("/api")]
    [InlineData("ftp://example.test")]
    public void IsHttpUrl_RejectsMissingRelativeAndNonHttpUrls(string? value)
    {
        Assert.False(TerminalEndpoints.IsHttpUrl(value));
    }
}

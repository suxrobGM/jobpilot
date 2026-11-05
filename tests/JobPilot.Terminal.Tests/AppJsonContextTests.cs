using System.Text.Json;
using JobPilot.Terminal.Hosting;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Sessions;
using Xunit;

namespace JobPilot.Terminal.Tests;

public class AppJsonContextTests
{
    [Fact]
    public void BrowserMessage_ReadsTheEnvelopesTheBrowserSends()
    {
        var input = JsonSerializer.Deserialize("""{"type":"input","data":"aGk="}""", AppJsonContext.Default.BrowserMessage);
        var resize = JsonSerializer.Deserialize("""{"type":"resize","cols":120,"rows":40}""", AppJsonContext.Default.BrowserMessage);
        var partial = JsonSerializer.Deserialize("""{"type":"resize"}""", AppJsonContext.Default.BrowserMessage);

        Assert.Equal(new BrowserMessage("input", "aGk=", null, null), input);
        Assert.Equal(new BrowserMessage("resize", null, 120, 40), resize);
        Assert.Equal(new BrowserMessage("resize", null, null, null), partial);
    }

    [Fact]
    public void Requests_BindTheBodiesTheWebSends()
    {
        var start = JsonSerializer.Deserialize(
            """{"provider":"codex","cols":120,"rows":40,"apiToken":"tok","apiUrl":"https://api","webUrl":"https://web"}""",
            AppJsonContext.Default.StartSessionRequest);
        var pilot = JsonSerializer.Deserialize(
            """{"provider":"claude","apiToken":"tok","apiUrl":"https://api","webUrl":"https://web","userId":"u1"}""",
            AppJsonContext.Default.PilotPairRequest);

        Assert.Equal(new StartSessionRequest(120, 40, "codex", "tok", "https://api", "https://web"), start);
        Assert.Equal(new PilotPairRequest("claude", "tok", "https://api", "https://web", "u1"), pilot);
    }

    [Fact]
    public void StatusResponse_SerializesCamelCase()
    {
        var json = JsonSerializer.Serialize(
            new StatusResponse
            {
                Status = "ok",
                Session = "stopped",
                Provider = "claude",
                Providers = [new ProviderInfo("claude", "Claude Code")],
                HostVersion = "2.0.8",
                CanRelaunch = true,
                CanUpdate = false,
                Pilot = new PilotStatus { Paired = false, Conducting = false, ConsecutiveTimeouts = 0 },
            },
            AppJsonContext.Default.StatusResponse);

        Assert.Contains("\"hostVersion\":\"2.0.8\"", json);
        Assert.Contains("\"canRelaunch\":true", json);
        Assert.Contains("\"displayName\":\"Claude Code\"", json);
        Assert.DoesNotContain("HostVersion", json);
    }

    [Fact]
    public void ProblemDetails_SerializesTheLowercaseFieldsTheWebReads()
    {
        var json = JsonSerializer.Serialize(
            new Microsoft.AspNetCore.Mvc.ProblemDetails { Title = "t", Detail = "d", Status = 500 },
            AppJsonContext.Default.ProblemDetails);

        Assert.Contains("\"detail\":\"d\"", json);
        Assert.Contains("\"title\":\"t\"", json);
    }
}

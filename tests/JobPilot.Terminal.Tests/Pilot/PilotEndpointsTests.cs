using JobPilot.Terminal.Pilot;
using Xunit;

namespace JobPilot.Terminal.Tests.Pilot;

public class PilotEndpointsTests
{
    [Theory]
    [InlineData("https://api.example.test", true)]
    [InlineData("http://localhost:4101", true)]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData("/api", false)]
    [InlineData("ftp://example.test", false)]
    public void IsHttpUrl_AcceptsOnlyAbsoluteHttpUrls(string? value, bool expected)
    {
        Assert.Equal(expected, PilotEndpoints.IsHttpUrl(value));
    }
}

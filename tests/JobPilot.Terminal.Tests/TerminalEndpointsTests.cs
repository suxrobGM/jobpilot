using JobPilot.Terminal.Hosting;
using Xunit;

namespace JobPilot.Terminal.Tests;

public sealed class TerminalEndpointsTests
{
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

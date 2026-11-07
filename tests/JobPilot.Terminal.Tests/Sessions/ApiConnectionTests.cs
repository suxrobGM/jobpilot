using JobPilot.Terminal.Sessions;
using Xunit;

namespace JobPilot.Terminal.Tests.Sessions;

public class ApiConnectionTests
{
    [Theory]
    [InlineData("https://api.example.test", true)]
    [InlineData("http://localhost:4101", true)]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData("/api", false)]
    [InlineData("ftp://example.test", false)]
    public void TryParse_AcceptsOnlyAbsoluteHttpUrls(string? url, bool valid)
    {
        Assert.Equal(valid, ApiConnection.TryParse("token", url, "https://web.example.test", out _, out _));
        Assert.Equal(valid, ApiConnection.TryParse("token", "https://api.example.test", url, out _, out _));
    }

    [Theory]
    [InlineData(null)]
    [InlineData(" ")]
    public void TryParse_RejectsABlankToken(string? token)
    {
        Assert.False(ApiConnection.TryParse(token, "https://api", "https://web", out _, out var problem));
        Assert.Equal("apiToken must be a non-empty string.", problem);
    }
}

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
    public void Invalid_AcceptsOnlyAbsoluteHttpUrls(string? url, bool valid)
    {
        Assert.Equal(valid, ApiConnection.Invalid("token", url, "https://web.example.test") is null);
        Assert.Equal(valid, ApiConnection.Invalid("token", "https://api.example.test", url) is null);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(" ")]
    public void Invalid_RejectsABlankToken(string? token)
    {
        Assert.Equal("apiToken must be a non-empty string.", ApiConnection.Invalid(token, "https://api", "https://web"));
    }
}

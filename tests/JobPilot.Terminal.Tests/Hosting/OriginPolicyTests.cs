using JobPilot.Terminal.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace JobPilot.Terminal.Tests.Hosting;

public class OriginPolicyTests
{
    private static IConfiguration Config(params string[] origins) => new ConfigurationBuilder()
        .AddInMemoryCollection(origins.Select((o, i) => new KeyValuePair<string, string?>($"Terminal:AllowedOrigins:{i}", o)))
        .Build();

    [Fact]
    public void Resolve_ReadsTheShippedAllowlist()
    {
        var repo = new DirectoryInfo(AppContext.BaseDirectory);
        while (!File.Exists(Path.Combine(repo.FullName, "JobPilot.slnx")))
        {
            repo = repo.Parent!;
        }

        var shipped = new ConfigurationBuilder()
            .AddJsonFile(Path.Combine(repo.FullName, "apps", "terminal", "appsettings.json"))
            .Build();

        Assert.Equal(
            ["http://localhost:4100", "http://127.0.0.1:4100", "https://jobpilot.suxrobgm.net"],
            OriginPolicy.Resolve(shipped));
    }

    [Fact]
    public void Resolve_AllowsNothing_WhenUnconfigured()
    {
        Assert.Empty(OriginPolicy.Resolve(Config()));
    }

    [Fact]
    public void Resolve_StripsTrailingSlashes_AndDeduplicatesCaseInsensitively()
    {
        // Origin headers never carry a trailing slash.
        Assert.Equal(["https://Example.test"], OriginPolicy.Resolve(Config("https://Example.test", "https://example.test/")));
    }

    [Theory]
    [InlineData("https://example.test", true)]
    [InlineData(null, true)]
    [InlineData("https://attacker.test", false)]
    public async Task RejectOtherOrigins_StopsForeignBrowsersBeforeTheEndpoint(string? origin, bool allowed)
    {
        var reachedEndpoint = false;
        var context = new DefaultHttpContext();
        if (origin is not null)
        {
            context.Request.Headers.Origin = origin;
        }

        var middleware = OriginPolicy.RejectOtherOrigins(Config("https://example.test"), _ =>
        {
            reachedEndpoint = true;
            return Task.CompletedTask;
        });
        await middleware(context);

        Assert.Equal(allowed, reachedEndpoint);
        Assert.Equal(allowed ? StatusCodes.Status200OK : StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }
}

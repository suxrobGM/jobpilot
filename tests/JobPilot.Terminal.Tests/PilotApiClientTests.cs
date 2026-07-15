using System.Net;
using JobPilot.Terminal.Pilot;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests;

public sealed class PilotApiClientTests
{
    [Fact]
    public async Task ReportSystemAsync_PostsTheJournalEnvelope_WithABearerHeader()
    {
        HttpRequestMessage? seen = null;
        string? body = null;
        var handler = new StubHandler(async (request, ct) =>
        {
            seen = request;
            body = request.Content is null ? null : await request.Content.ReadAsStringAsync(ct);
            return new HttpResponseMessage(HttpStatusCode.OK);
        });
        using var client = new PilotApiClient(NullLogger<PilotApiClient>.Instance, new HttpClient(handler));

        await client.ReportSystemAsync("https://api.example.test/", "secret-token", "hello world");

        Assert.NotNull(seen);
        Assert.Equal(HttpMethod.Post, seen!.Method);
        Assert.Equal("https://api.example.test/api/pilot/journal", seen.RequestUri!.ToString());
        Assert.Equal("Bearer", seen.Headers.Authorization!.Scheme);
        Assert.Equal("secret-token", seen.Headers.Authorization.Parameter);
        Assert.Equal("""{"entries":[{"kind":"system","summary":"hello world"}]}""", body);
    }

    [Fact]
    public async Task ReportSystemAsync_SkipsTheCall_WhenUnpaired()
    {
        var called = false;
        var handler = new StubHandler((_, _) =>
        {
            called = true;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
        });
        using var client = new PilotApiClient(NullLogger<PilotApiClient>.Instance, new HttpClient(handler));

        await client.ReportSystemAsync("", "", "nobody home");
        await client.ReportSystemAsync("https://api.example.test", "", "no token");

        Assert.False(called);
    }

    [Fact]
    public async Task ReportSystemAsync_DoesNotThrow_OnANonSuccessStatus()
    {
        var handler = new StubHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.InternalServerError)));
        using var client = new PilotApiClient(NullLogger<PilotApiClient>.Instance, new HttpClient(handler));

        await client.ReportSystemAsync("https://api.example.test", "tok", "boom"); // must not throw
    }

    [Fact]
    public async Task ReportSystemAsync_DoesNotThrow_OnATransportFailureOrTimeout()
    {
        var refused = new StubHandler((_, _) => throw new HttpRequestException("connection refused"));
        using var a = new PilotApiClient(NullLogger<PilotApiClient>.Instance, new HttpClient(refused));
        await a.ReportSystemAsync("https://api.example.test", "tok", "unreachable"); // must not throw

        var timedOut = new StubHandler((_, ct) => throw new TaskCanceledException("timed out", null, ct));
        using var b = new PilotApiClient(NullLogger<PilotApiClient>.Instance, new HttpClient(timedOut));
        await b.ReportSystemAsync("https://api.example.test", "tok", "slow"); // must not throw
    }

    private sealed class StubHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> respond)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            respond(request, ct);
    }
}

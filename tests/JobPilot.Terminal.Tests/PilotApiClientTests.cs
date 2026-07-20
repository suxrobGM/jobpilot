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

    [Fact]
    public async Task GetLastActivityAsync_ParsesTheTimestamp_WithABearerHeader()
    {
        HttpRequestMessage? seen = null;
        var handler = new StubHandler((request, _) =>
        {
            seen = request;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"lastActivityAt":"2026-07-19T18:34:43Z","activeLeases":2}"""),
            });
        });
        using var client = new PilotApiClient(NullLogger<PilotApiClient>.Instance, new HttpClient(handler));

        var at = await client.GetLastActivityAsync("https://api.example.test/", "secret-token");

        Assert.NotNull(seen);
        Assert.Equal(HttpMethod.Get, seen!.Method);
        Assert.Equal("https://api.example.test/api/pilot/activity", seen.RequestUri!.ToString());
        Assert.Equal("secret-token", seen.Headers.Authorization!.Parameter);
        Assert.Equal(new DateTimeOffset(2026, 7, 19, 18, 34, 43, TimeSpan.Zero), at);
    }

    [Fact]
    public async Task GetLastActivityAsync_ReturnsNull_WhenTheServerReportsNoActivity()
    {
        var handler = new StubHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"lastActivityAt":null,"activeLeases":0}"""),
        }));
        using var client = new PilotApiClient(NullLogger<PilotApiClient>.Instance, new HttpClient(handler));

        Assert.Null(await client.GetLastActivityAsync("https://api.example.test", "tok"));
    }

    [Fact]
    public async Task GetLastActivityAsync_ReturnsNull_WhenUnpaired()
    {
        var called = false;
        var handler = new StubHandler((_, _) =>
        {
            called = true;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
        });
        using var client = new PilotApiClient(NullLogger<PilotApiClient>.Instance, new HttpClient(handler));

        Assert.Null(await client.GetLastActivityAsync("", ""));
        Assert.Null(await client.GetLastActivityAsync("https://api.example.test", ""));
        Assert.False(called);
    }

    [Fact]
    public async Task GetLastActivityAsync_ReturnsNull_OnNonSuccessOrTransportFailure()
    {
        var rejected = new StubHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.InternalServerError)));
        using var a = new PilotApiClient(NullLogger<PilotApiClient>.Instance, new HttpClient(rejected));
        Assert.Null(await a.GetLastActivityAsync("https://api.example.test", "tok"));

        var refused = new StubHandler((_, _) => throw new HttpRequestException("connection refused"));
        using var b = new PilotApiClient(NullLogger<PilotApiClient>.Instance, new HttpClient(refused));
        Assert.Null(await b.GetLastActivityAsync("https://api.example.test", "tok"));
    }

    [Fact]
    public async Task GetLastActivityAsync_ReturnsNull_OnAMalformedBody()
    {
        var handler = new StubHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("not json at all"),
        }));
        using var client = new PilotApiClient(NullLogger<PilotApiClient>.Instance, new HttpClient(handler));

        Assert.Null(await client.GetLastActivityAsync("https://api.example.test", "tok"));
    }

    [Fact]
    public async Task Requests_PropagateCallerCancellation()
    {
        var blocked = new StubHandler(async (_, ct) =>
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, ct);
            return new HttpResponseMessage(HttpStatusCode.OK);
        });
        using var client = new PilotApiClient(NullLogger<PilotApiClient>.Instance, new HttpClient(blocked));
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            client.GetLastActivityAsync("https://api.example.test", "tok", cts.Token));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            client.ReportSystemAsync("https://api.example.test", "tok", "stop", cts.Token));
    }

    private sealed class StubHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> respond)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            respond(request, ct);
    }
}

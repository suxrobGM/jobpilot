using System.Net;
using JobPilot.Terminal.Install;
using JobPilot.Terminal.Pilot.Api;
using JobPilot.Terminal.Pilot.Pairing;
using JobPilot.Terminal.Tests.Support;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using static JobPilot.Terminal.Tests.Support.Builders;

namespace JobPilot.Terminal.Tests.Pilot.Api;

public sealed class PilotApiTests : IDisposable
{
    private const string ActivityJson =
        """{"lastActivityAt":"2026-07-19T18:34:43Z","lastCycle":{"completedAt":"2026-07-19T18:30:00Z","sleepSeconds":300},"activeRuns":2}""";

    private readonly TempDir temp = new();

    private readonly FakeHostSelfUpdate selfUpdate = new();

    private PilotApi Api(
        Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> respond, PilotPairing? pairing = null)
    {
        var store = temp.PairingStore();
        store.Save(pairing ?? NewPairing());
        return new(new HttpClient(new StubHandler(respond)), store, selfUpdate, NullLogger<PilotApi>.Instance);
    }

    public void Dispose() => temp.Dispose();

    private static Task<HttpResponseMessage> Respond(HttpStatusCode status, string? body = null) =>
        Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body ?? "") });

    [Fact]
    public async Task GetActivity_ParsesTheResponse_WithABearerHeader()
    {
        HttpRequestMessage? seen = null;
        var api = Api(
            (request, _) =>
            {
                seen = request;
                return Respond(HttpStatusCode.OK, ActivityJson);
            },
            NewPairing(apiUrl: "https://api.example.test"));

        var activity = await api.GetActivityAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpMethod.Get, seen!.Method);
        Assert.Equal("https://api.example.test/api/pilot/activity", seen.RequestUri!.ToString());
        Assert.Equal("Bearer tok", seen.Headers.Authorization!.ToString());
        Assert.Equal(
            new PilotActivity(
                new DateTimeOffset(2026, 7, 19, 18, 34, 43, TimeSpan.Zero),
                new CompletedCycle(new DateTimeOffset(2026, 7, 19, 18, 30, 0, TimeSpan.Zero), 300)),
            activity);
    }

    [Fact]
    public async Task Calls_ReturnNull_OnARejectionATransportFailureATimeoutOrABadBody()
    {
        var ct = TestContext.Current.CancellationToken;

        Assert.Null(await Api((_, _) => Respond(HttpStatusCode.Unauthorized)).GetActivityAsync(ct));
        Assert.Null(await Api((_, _) => throw new HttpRequestException("refused")).GetActivityAsync(ct));
        Assert.Null(await Api((_, token) => throw new TaskCanceledException("timed out", null, token)).GetActivityAsync(ct));
        Assert.Null(await Api((_, _) => Respond(HttpStatusCode.OK, "{ not json")).GetActivityAsync(ct));
    }

    [Fact]
    public async Task RefreshTasks_ReadsTheTaskList()
    {
        const string body = """{"tasks":[{"id":"t1","title":"Apply to Acme","taskType":"job.apply"}],"emptyReason":null,"sleepSeconds":15,"nextWakeAt":"2026-10-02T12:00:15Z"}""";
        var api = Api((_, _) => Respond(HttpStatusCode.OK, body));

        var taskList = await api.RefreshTasksAsync(TestContext.Current.CancellationToken);

        Assert.Equal([new PilotTask("t1")], taskList!.Tasks);
        Assert.Equal(15, taskList.SleepSeconds);
    }

    [Fact]
    public async Task Calls_SendTheirBodies_ToTheirRoutes()
    {
        List<string> seen = [];
        var api = Api(async (request, ct) =>
        {
            var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(ct);
            seen.Add($"{request.Method} {request.RequestUri!.AbsolutePath} {body}".TrimEnd());
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"id":"run-1","finishedAt":null,"outcome":null,"taskType":"job.apply"}"""),
            };
        });
        var ct = TestContext.Current.CancellationToken;

        await api.RefreshTasksAsync(ct);
        await api.RecordCycleAsync(30, null, ct);
        await api.RecordCycleAsync(1800, "Taking a break.", ct);
        Assert.Equal(new PilotRun("run-1", null, null), await api.StartRunAsync("t1", ct));
        Assert.NotNull(await api.GetRunAsync("run-1", ct));
        await api.CancelRunAsync("run-1", ct);
        await api.ReportUsageAsync("run-1", new PilotUsage("claude-sonnet-5", 4, 320, 130000, 600), ct);

        Assert.Equal(
            [
                "POST /api/pilot/tasks/refresh",
                """POST /api/pilot/cycles {"sleepSeconds":30}""",
                """POST /api/pilot/cycles {"sleepSeconds":1800,"message":"Taking a break."}""",
                """POST /api/pilot/runs {"taskId":"t1"}""",
                "GET /api/pilot/runs/run-1",
                "POST /api/pilot/runs/run-1/cancel",
                """POST /api/pilot/runs/run-1/usage {"model":"claude-sonnet-5","inputTokens":4,"outputTokens":320,"cacheReadTokens":130000,"cacheWriteTokens":600}""",
            ],
            seen);
    }

    [Fact]
    public async Task Calls_SayTheHostVersion_AndA426StartsAnUpdate()
    {
        List<string?> versions = [];
        var api = Api((request, _) =>
        {
            versions.Add(request.Headers.GetValues("x-jobpilot-version").SingleOrDefault());
            return Respond(HttpStatusCode.UpgradeRequired);
        });

        Assert.Null(await api.GetActivityAsync(TestContext.Current.CancellationToken));

        Assert.Equal([HostInstall.HostVersion], versions);
        Assert.Equal(1, selfUpdate.Starts);
    }

    [Fact]
    public async Task Calls_PropagateTheCallersCancellation()
    {
        var api = Api(async (_, ct) =>
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, ct);
            return new HttpResponseMessage(HttpStatusCode.OK);
        });
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => api.GetActivityAsync(cts.Token));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => api.RecordCycleAsync(30, null, cts.Token));
    }

    private sealed class StubHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> respond)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            respond(request, ct);
    }
}

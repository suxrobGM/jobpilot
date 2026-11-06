using System.Collections.Concurrent;
using System.Net;
using JobPilot.Terminal.Pilot;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using static JobPilot.Terminal.Tests.Builders;

namespace JobPilot.Terminal.Tests;

public sealed class PilotEventListenerTests
{
    [Theory]
    [InlineData("""{"type":"question.answered","question":{}}""", true)]
    [InlineData("""{"type":"state.changed","state":{}}""", true)]
    [InlineData("""{"type":"journal.appended","entry":{}}""", false)]
    [InlineData("""{"type":"question.created","question":{}}""", false)]
    [InlineData("""{"type":"message.created","message":{}}""", true)]
    [InlineData("""{"type":"request.created","request":{}}""", true)]
    [InlineData("""{"type":"change.updated","change":{}}""", false)]
    public void ShouldWake_OnlyOnEventsThatUnblockTheNextCycle(string data, bool expected)
    {
        Assert.Equal(expected, PilotEventListener.ShouldWake(PilotEventListener.Parse(data)!));
    }

    [Theory]
    [InlineData("")]
    [InlineData("{not json")]
    public void Parse_IgnoresControlFramesAndGarbage(string data)
    {
        Assert.Null(PilotEventListener.Parse(data));
    }

    [Fact]
    public async Task Listener_Connects_AndWakesTheLoop_OnAnEvent()
    {
        await using var h = await Harness.StartAsync();

        h.Push("event: ping\n\n");
        h.Push("data: {\"type\":\"question.answered\",\"question\":{}}\n\n");

        await TestWait.Until(() => h.Wakes == 1);
        Assert.Equal("Bearer tok", h.Handler.LastRequest?.Headers.Authorization?.ToString());
        Assert.Contains("text/event-stream", h.Handler.LastRequest?.Headers.Accept.ToString());
    }

    [Fact]
    public async Task Listener_PassesAFinishedRunOn_WithoutWakingTheLoop()
    {
        await using var h = await Harness.StartAsync();

        h.Push("data: {\"type\":\"run.finished\",\"runId\":\"run-1\",\"outcome\":\"done\"}\n\n");

        await TestWait.Until(() => !h.FinishedRuns.IsEmpty);
        Assert.Equal(["run-1:done"], h.FinishedRuns);
        Assert.Equal(0, h.Wakes);
    }

    [Fact]
    public async Task Listener_Disconnects_WhenTheHostIsUnpaired()
    {
        await using var h = await Harness.StartAsync();

        h.Store.Clear();

        await TestWait.Until(() => h.Handler.Stream.Disposed);
    }

    [Fact]
    public async Task Listener_HandsInterruptsAndSteersOn()
    {
        await using var h = await Harness.StartAsync();

        h.Push("data: {\"type\":\"run.interrupt\",\"runId\":\"run-1\"}\n\n");
        h.Push("data: {\"type\":\"run.steer\",\"runId\":\"run-1\",\"text\":\"skip cover letters\"}\n\n");

        await TestWait.Until(() => h.RunCommands.Count == 2);
        Assert.Equal(["interrupt:run-1", "steer:run-1:skip cover letters"], h.RunCommands);
    }

    [Fact]
    public async Task Listener_ReconnectsAtOnce_WithNewSettings()
    {
        await using var h = await Harness.StartAsync();

        h.Store.Save(Settings(apiUrl: "https://next-api", apiToken: "next-token"));

        await TestWait.Until(() => h.Handler.Calls == 2);
        Assert.Equal("https://next-api/api/pilot/events", h.Handler.LastRequest?.RequestUri?.ToString());
        Assert.Equal("Bearer next-token", h.Handler.LastRequest?.Headers.Authorization?.ToString());
    }

    [Fact]
    public async Task Listener_BacksOff_AfterARejectedStream()
    {
        await using var h = await Harness.StartAsync(HttpStatusCode.Unauthorized);

        await Task.Delay(50, TestContext.Current.CancellationToken);

        Assert.Equal(1, h.Handler.Calls);
    }

    private sealed class Harness : IAsyncDisposable
    {
        private readonly TempDir temp = new();
        private readonly PilotEventListener listener;
        private int wakes;

        private Harness(HttpStatusCode status)
        {
            Handler = new FakeSseHandler { Status = status };
            Store = new PilotStore(Path.Combine(temp.Root, "pilot.json"), NullLogger<PilotStore>.Instance);
            var api = new PilotApi(new HttpClient(Handler), NullLogger<PilotApi>.Instance);
            var handlers = new PilotEventHandlers(
                () => Interlocked.Increment(ref wakes),
                (runId, outcome) => FinishedRuns.Enqueue($"{runId}:{outcome}"),
                (runId, _) =>
                {
                    RunCommands.Enqueue($"interrupt:{runId}");
                    return Task.CompletedTask;
                },
                (runId, text, _) =>
                {
                    RunCommands.Enqueue($"steer:{runId}:{text}");
                    return Task.CompletedTask;
                });
            listener = new PilotEventListener(Store, api, handlers, NullLogger<PilotEventListener>.Instance);
        }

        public FakeSseHandler Handler { get; }

        public ConcurrentQueue<string> FinishedRuns { get; } = new();

        public ConcurrentQueue<string> RunCommands { get; } = new();

        public PilotStore Store { get; }

        public int Wakes => Volatile.Read(ref wakes);

        public static async Task<Harness> StartAsync(HttpStatusCode status = HttpStatusCode.OK)
        {
            var harness = new Harness(status);
            harness.Store.Save(Settings());
            await harness.listener.StartAsync(CancellationToken.None);
            await TestWait.Until(() => harness.Handler.Calls > 0);
            return harness;
        }

        public void Push(string frame) => Handler.Stream.Push(frame);

        public async ValueTask DisposeAsync()
        {
            await listener.StopAsync(CancellationToken.None);
            listener.Dispose();
            temp.Dispose();
        }
    }
}

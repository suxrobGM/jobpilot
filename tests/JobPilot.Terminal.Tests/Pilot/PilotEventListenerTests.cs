using System.Net;
using JobPilot.Terminal.Pilot;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests;

public sealed class PilotEventListenerTests
{
    private static SseFrame Frame(string data, string? name = null) => new(name, data);

    // --- ShouldWake: which events wake the conductor ---

    [Theory]
    [InlineData("{\"type\":\"question.answered\",\"question\":{}}")]
    [InlineData("{\"type\":\"state.changed\",\"state\":{}}")]
    [InlineData("{\"type\":\"promotion.updated\",\"promotion\":{\"status\":\"approved\"}}")]
    public void ShouldWake_OnWakeWorthyEvents(string data)
    {
        Assert.True(PilotEventListener.ShouldWake(Frame(data)));
    }

    [Theory]
    [InlineData("{\"type\":\"promotion.updated\",\"promotion\":{\"status\":\"draft\"}}")]
    [InlineData("{\"type\":\"journal.appended\",\"entry\":{}}")]
    [InlineData("{\"type\":\"question.created\",\"question\":{}}")]
    [InlineData("{\"type\":\"promotion.created\",\"promotion\":{\"status\":\"draft\"}}")]
    [InlineData("{not json")]
    public void ShouldNotWake_OnEverythingElse(string data)
    {
        Assert.False(PilotEventListener.ShouldWake(Frame(data)));
    }

    [Fact]
    public void ShouldNotWake_OnControlFramesWithNoData()
    {
        Assert.False(PilotEventListener.ShouldWake(Frame(string.Empty, "connected")));
        Assert.False(PilotEventListener.ShouldWake(Frame(string.Empty, "ping")));
    }

    // --- IsRemoteStop: only a state.changed carrying running=false syncs the local store ---

    [Fact]
    public void IsRemoteStop_OnStateChangedWithRunningFalse()
    {
        Assert.True(PilotEventListener.IsRemoteStop(
            Frame("{\"type\":\"state.changed\",\"state\":{\"running\":false}}")));
    }

    [Theory]
    [InlineData("{\"type\":\"state.changed\",\"state\":{\"running\":true}}")]
    [InlineData("{\"type\":\"state.changed\",\"state\":{}}")]
    [InlineData("{\"type\":\"question.answered\",\"question\":{}}")]
    [InlineData("{not json")]
    public void IsRemoteStop_IsFalse_ForEverythingElse(string data)
    {
        Assert.False(PilotEventListener.IsRemoteStop(Frame(data)));
    }

    // --- ShouldConnect: connect only when enabled, paired, and addressable ---

    [Fact]
    public void ShouldConnect_OnlyWhenEnabledPairedAndAddressable()
    {
        Assert.True(PilotEventListener.ShouldConnect(TestPairing.Create()));
        Assert.False(PilotEventListener.ShouldConnect(null));
        Assert.False(PilotEventListener.ShouldConnect(TestPairing.Create(running: false)));
        Assert.False(PilotEventListener.ShouldConnect(TestPairing.Create(apiUrl: "")));
    }

    // --- End-to-end: connect, wake on a domain event, tear down on disable ---

    [Fact]
    public async Task Listener_ConnectsAndWakesTheConductor_OnAWakeWorthyEvent()
    {
        await using var h = await Harness.StartAsync();

        var wakesBefore = h.Conductor.WakeCount;

        h.Push("data: {\"type\":\"question.answered\",\"question\":{}}\n\n");
        await TestWait.Until(() => h.Conductor.WakeCount > wakesBefore);

        Assert.Equal("Bearer tok", h.Handler.LastRequest?.Headers.Authorization?.ToString());
        Assert.Contains("text/event-stream", h.Handler.LastRequest?.Headers.Accept.ToString());
    }

    [Fact]
    public async Task Listener_DoesNotWake_OnAControlFrame()
    {
        await using var h = await Harness.StartAsync();
        var wakes = h.Conductor.WakeCount;

        h.Push("event: ping\n\n");
        await Task.Delay(50);

        Assert.Equal(wakes, h.Conductor.WakeCount);
    }

    [Fact]
    public async Task Listener_TearsDown_WhenThePilotIsDisabled()
    {
        await using var h = await Harness.StartAsync();

        h.Store.SetRunning(false);
        // A heartbeat unblocks the read so the listener re-checks the pairing and tears down.
        h.Push("event: ping\n\n");

        await TestWait.Until(() => h.Handler.Stream.Disposed);
    }

    [Fact]
    public async Task Listener_SyncsTheLocalStore_AndWakes_OnARemoteStop()
    {
        await using var h = await Harness.StartAsync();
        var wakesBefore = h.Conductor.WakeCount;

        // Stopped from another device: the API-side state must win over the stale local Running=true.
        h.Push("data: {\"type\":\"state.changed\",\"state\":{\"running\":false}}\n\n");

        await TestWait.Until(() => h.Store.Current is { Running: false });
        await TestWait.Until(() => h.Conductor.WakeCount > wakesBefore);
    }

    [Fact]
    public async Task Listener_KeepsTheLocalStoreRunning_OnAStateChangedThatStaysRunning()
    {
        await using var h = await Harness.StartAsync();
        var wakesBefore = h.Conductor.WakeCount;

        h.Push("data: {\"type\":\"state.changed\",\"state\":{\"running\":true}}\n\n");
        await TestWait.Until(() => h.Conductor.WakeCount > wakesBefore);

        Assert.True(h.Store.Current is { Running: true });
    }

    [Fact]
    public async Task Listener_ReconnectsWithTheNewPairing_AfterTheNextHeartbeat()
    {
        await using var h = await Harness.StartAsync();

        h.Store.Save(TestPairing.Create(apiUrl: "https://next-api", apiToken: "next-token"));
        await Task.Delay(25);
        Assert.Equal(1, h.Handler.Calls); // A blocked stream is intentionally heartbeat-bounded.

        h.Push("event: ping\n\n");

        await TestWait.Until(() => h.Handler.Calls >= 2);
        Assert.Equal("https://next-api/api/pilot/events", h.Handler.LastRequest?.RequestUri?.ToString());
        Assert.Equal("Bearer next-token", h.Handler.LastRequest?.Headers.Authorization?.ToString());
    }

    [Fact]
    public async Task Listener_StaysDisconnected_OnARejectedStream()
    {
        await using var h = await Harness.StartAsync(HttpStatusCode.Unauthorized);

        await TestWait.Until(() => h.Handler.Calls > 0);
        await Task.Delay(50);

        Assert.Equal(1, h.Handler.Calls);
    }

    /// <summary>A started, paired listener over a fake SSE stream; disposal stops and cleans everything up.</summary>
    private sealed class Harness : IAsyncDisposable
    {
        private readonly TempDir temp = new();

        public FakeSseHandler Handler { get; }
        public PilotEventListener Listener { get; }
        public PilotCoordinator Conductor { get; }
        public PilotStore Store { get; }

        private Harness(HttpStatusCode status)
        {
            Handler = new FakeSseHandler { Status = status };
            Store = new PilotStore(Path.Combine(temp.Root, "pilot.json"), NullLogger<PilotStore>.Instance);
            Conductor = new PilotCoordinator(Store, new FakePilotRuntime(), NullLogger<PilotCoordinator>.Instance);
            Listener = new PilotEventListener(Store, Conductor, NullLogger<PilotEventListener>.Instance, new HttpClient(Handler));
        }

        /// <summary>On an OK stream, also pushes the connected frame and waits for the subscription.</summary>
        public static async Task<Harness> StartAsync(HttpStatusCode status = HttpStatusCode.OK)
        {
            var harness = new Harness(status);
            harness.Store.Save(TestPairing.Create());
            await harness.Listener.StartAsync(CancellationToken.None);
            if (status == HttpStatusCode.OK)
            {
                await TestWait.Until(() => harness.Handler.Calls > 0);
            }
            return harness;
        }

        public void Push(string frame) => Handler.Stream.Push(frame);

        public async ValueTask DisposeAsync()
        {
            await Listener.StopAsync(CancellationToken.None);
            Listener.Dispose();
            Conductor.Dispose();
            temp.Dispose();
        }
    }
}

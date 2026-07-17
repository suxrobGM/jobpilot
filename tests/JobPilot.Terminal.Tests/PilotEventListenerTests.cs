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

    // --- IsRemoteDisable: only a state.changed carrying enabled=false syncs the local store ---

    [Fact]
    public void IsRemoteDisable_OnStateChangedWithEnabledFalse()
    {
        Assert.True(PilotEventListener.IsRemoteDisable(
            Frame("{\"type\":\"state.changed\",\"state\":{\"enabled\":false}}")));
    }

    [Theory]
    [InlineData("{\"type\":\"state.changed\",\"state\":{\"enabled\":true}}")]
    [InlineData("{\"type\":\"state.changed\",\"state\":{}}")]
    [InlineData("{\"type\":\"question.answered\",\"question\":{}}")]
    [InlineData("{not json")]
    public void IsRemoteDisable_IsFalse_ForEverythingElse(string data)
    {
        Assert.False(PilotEventListener.IsRemoteDisable(Frame(data)));
    }

    // --- ShouldConnect: connect only when enabled, paired, and addressable ---

    [Fact]
    public void ShouldConnect_OnlyWhenEnabledPairedAndAddressable()
    {
        Assert.True(PilotEventListener.ShouldConnect(TestPairing.Create()));
        Assert.False(PilotEventListener.ShouldConnect(null));
        Assert.False(PilotEventListener.ShouldConnect(TestPairing.Create(enabled: false)));
        Assert.False(PilotEventListener.ShouldConnect(TestPairing.Create(apiUrl: "")));
    }

    // --- End-to-end: connect, wake on a domain event, tear down on disable ---

    [Fact]
    public async Task Listener_ConnectsAndWakesTheConductor_OnAWakeWorthyEvent()
    {
        await using var h = await Harness.StartAsync();

        Assert.True(h.Conductor.BuildStatus().Connected);
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

        h.Store.SetEnabled(false);
        // A heartbeat unblocks the read so the listener re-checks the pairing and tears down.
        h.Push("event: ping\n\n");

        await TestWait.Until(() => !h.Listener.Connected);
        Assert.False(h.Conductor.BuildStatus().Connected);
    }

    [Fact]
    public async Task Listener_SyncsTheLocalStore_AndWakes_OnARemoteDisable()
    {
        await using var h = await Harness.StartAsync();
        var wakesBefore = h.Conductor.WakeCount;

        // Disabled from another device: the API-side state must win over the stale local Enabled=true.
        h.Push("data: {\"type\":\"state.changed\",\"state\":{\"enabled\":false}}\n\n");

        await TestWait.Until(() => h.Store.Current is { Enabled: false });
        await TestWait.Until(() => h.Conductor.WakeCount > wakesBefore);
        await TestWait.Until(() => !h.Listener.Connected); // the now-disabled store also tears the stream down
    }

    [Fact]
    public async Task Listener_KeepsTheLocalStoreEnabled_OnAStateChangedThatStaysEnabled()
    {
        await using var h = await Harness.StartAsync();
        var wakesBefore = h.Conductor.WakeCount;

        h.Push("data: {\"type\":\"state.changed\",\"state\":{\"enabled\":true}}\n\n");
        await TestWait.Until(() => h.Conductor.WakeCount > wakesBefore);

        Assert.True(h.Store.Current is { Enabled: true });
        Assert.True(h.Listener.Connected);
    }

    [Fact]
    public async Task Listener_StaysDisconnected_OnARejectedStream()
    {
        await using var h = await Harness.StartAsync(HttpStatusCode.Unauthorized);

        await TestWait.Until(() => h.Handler.Calls > 0);
        await Task.Delay(50);

        Assert.False(h.Listener.Connected);
    }

    /// <summary>A started, paired listener over a fake SSE stream; disposal stops and cleans everything up.</summary>
    private sealed class Harness : IAsyncDisposable
    {
        private readonly TempDir temp = new();

        public FakeSseHandler Handler { get; }
        public PilotEventListener Listener { get; }
        public PilotConductor Conductor { get; }
        public PilotStore Store { get; }

        private Harness(HttpStatusCode status)
        {
            Handler = new FakeSseHandler { Status = status };
            Store = new PilotStore(Path.Combine(temp.Root, ".jobpilot", "pilot.json"), NullLogger<PilotStore>.Instance);
            Conductor = new PilotConductor(Store, new FakePilotEnvironment(), NullLogger<PilotConductor>.Instance);
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
                harness.Push("event: connected\n\n");
                await TestWait.Until(() => harness.Listener.Connected);
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

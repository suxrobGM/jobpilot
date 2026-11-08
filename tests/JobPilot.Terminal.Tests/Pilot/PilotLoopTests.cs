using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Pilot.Pairing;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Tests.Support;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using static JobPilot.Terminal.Tests.Support.Builders;

namespace JobPilot.Terminal.Tests.Pilot;

public sealed class PilotLoopTests : IAsyncLifetime
{
    private readonly TempDir temp = new();
    private readonly FakePilot pilot = new() { BlockWhenUnscripted = true, DefaultActivity = Activity() };
    private PairingStore store;
    private PilotLoop loop;

    public PilotLoopTests()
    {
        (store, loop) = BuildHost();
    }

    private (PairingStore, PilotLoop) BuildHost()
    {
        var hostStore = temp.PairingStore();
        return (hostStore, new PilotLoop(hostStore, pilot, pilot, pilot.Time, new WakeSignal(), NullLogger<PilotLoop>.Instance));
    }

    /// <summary>Saves the pairing as an earlier run would have, then builds the host from disk.</summary>
    private void SavedBeforeRestart(PilotPairing pairing)
    {
        store.Save(pairing);
        loop.Dispose();
        (store, loop) = BuildHost();
    }

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    public async ValueTask DisposeAsync()
    {
        store.Clear();
        await loop.StopAsync(CancellationToken.None);
        loop.Dispose();
        temp.Dispose();
    }

    private int CyclesSent => pilot.Actions.Count(a => a == "cycle");

    [Fact]
    public async Task StaysIdle_WhenThePilotIsNotSetUp()
    {
        await loop.StartAsync(CancellationToken.None);
        await Task.Delay(50, TestContext.Current.CancellationToken);

        Assert.Empty(pilot.Actions);
        Assert.False(loop.GetStatus().Paired);
    }

    [Fact]
    public async Task Pairing_RunsCycles_AndUnpairing_InterruptsTheTurnButKeepsTheSession()
    {
        await loop.StartAsync(CancellationToken.None);

        store.Save(NewPairing());
        await TestWait.Until(() => CyclesSent == 1);
        Assert.Equal("user-1", loop.GetStatus().UserId);

        store.Clear();
        await TestWait.Until(() => pilot.Actions.Contains("abort-turn"));
        await Task.Delay(50, TestContext.Current.CancellationToken);

        Assert.Equal(1, CyclesSent);
        Assert.Contains("abort-turn", pilot.Actions);
        Assert.DoesNotContain("stop", pilot.Actions);
        Assert.False(loop.GetStatus().Paired);
    }

    [Fact]
    public async Task StaysAsleep_WithoutStartingTheAgent_WhileThereIsNoWork()
    {
        pilot.BlockSleep = true;
        pilot.TaskList = TaskList(sleep: 1800);
        await loop.StartAsync(CancellationToken.None);

        store.Save(NewPairing());

        await TestWait.Until(() => pilot.Actions.Contains("sleep:1800"));
        Assert.Equal(0, CyclesSent);
        Assert.DoesNotContain("start", pilot.Actions);
        Assert.Equal(["idle/1800"], pilot.Cycles);
    }

    [Fact]
    public async Task Wake_MidCycle_NeitherRestartsNorInterruptsTheTurn()
    {
        await loop.StartAsync(CancellationToken.None);
        store.Save(NewPairing());
        await TestWait.Until(() => pilot.Actions.Contains("wait"));

        loop.Wake(); // e.g. a question was answered mid-cycle
        await Task.Delay(50, TestContext.Current.CancellationToken);

        Assert.Equal(1, CyclesSent);
        Assert.DoesNotContain("abort-turn", pilot.Actions);
    }

    [Fact]
    public async Task Wake_DuringTheInterCycleSleep_StartsTheNextCycleNow()
    {
        pilot.BlockSleep = true;
        pilot.TaskList = TaskList(tasks: 1, sleep: 3600);
        // The pairing's own wake can land mid-cycle and skip the first sleep, so a second run is scripted.
        pilot.Signals.Enqueue(WaitResult.Finished("done"));
        pilot.Signals.Enqueue(WaitResult.Finished("done"));
        await loop.StartAsync(CancellationToken.None);
        store.Save(NewPairing());
        await TestWait.Until(() => pilot.Actions.Contains("sleep:3600"));
        var cyclesBeforeWake = CyclesSent;

        loop.Wake();

        await TestWait.Until(() => CyclesSent == cyclesBeforeWake + 1);
        Assert.DoesNotContain("abort-turn", pilot.Actions);
    }

    [Fact]
    public async Task Unpairing_DoesNotInterrupt_TheUsersOwnSessionOnTheOtherProvider()
    {
        pilot.RunningProvider = Provider.Codex;
        await loop.StartAsync(CancellationToken.None);
        store.Save(NewPairing());
        await TestWait.Until(() => pilot.Actions.Contains("sleep:5"));

        store.Clear();
        await Task.Delay(50, TestContext.Current.CancellationToken);

        Assert.DoesNotContain("abort-turn", pilot.Actions);
    }

    [Fact]
    public async Task Resume_StartsACycleRightAway_WhenNoBreakIsOwed()
    {
        SavedBeforeRestart(NewPairing());

        await loop.StartAsync(CancellationToken.None);

        await TestWait.Until(() => CyclesSent == 1);
        Assert.Contains(JournalLines.Resume, pilot.Reports);
    }

    [Fact]
    public async Task Resume_WaitsOutAnOwedBreak_BeforeTheFirstCycle()
    {
        pilot.DefaultActivity = Activity(DateTimeOffset.UtcNow, Completed(3600));
        SavedBeforeRestart(NewPairing());

        await loop.StartAsync(CancellationToken.None);

        await TestWait.Until(() => CyclesSent == 1);
        Assert.Contains(pilot.Reports, r => r.StartsWith(JournalLines.Resume, StringComparison.Ordinal) && r.Contains("planned break"));
        var breakSleep = pilot.Actions.FindIndex(a => a.StartsWith("sleep:", StringComparison.Ordinal) && int.Parse(a["sleep:".Length..]) > 60);
        Assert.InRange(breakSleep, 0, pilot.Actions.IndexOf("cycle") - 1);
    }

    [Fact]
    public async Task BacksOff_WhileTheApiIsUnreachable_AndAWakeProbesAgain()
    {
        pilot.BlockSleep = true;
        pilot.DefaultActivity = null;
        await loop.StartAsync(CancellationToken.None);
        store.Save(NewPairing());

        await TestWait.Until(() => pilot.Actions.Any(a => a.StartsWith("sleep:", StringComparison.Ordinal)));
        Assert.Equal(0, CyclesSent);
        Assert.NotNull(store.Current);

        pilot.DefaultActivity = Activity();
        loop.Wake();

        await TestWait.Until(() => CyclesSent == 1);
    }
}

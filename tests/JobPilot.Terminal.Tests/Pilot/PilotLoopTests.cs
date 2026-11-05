using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Providers;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using static JobPilot.Terminal.Tests.Builders;

namespace JobPilot.Terminal.Tests;

public sealed class PilotLoopTests : IAsyncLifetime
{
    private readonly TempDir temp = new();
    private readonly FakePilotSession session = new() { BlockWhenUnscripted = true, DefaultActivity = Activity() };
    private PilotStore store;
    private PilotLoop loop;

    public PilotLoopTests()
    {
        (store, loop) = BuildHost();
    }

    private (PilotStore, PilotLoop) BuildHost()
    {
        var hostStore = new PilotStore(Path.Combine(temp.Root, "pilot.json"), NullLogger<PilotStore>.Instance);
        return (hostStore, new PilotLoop(hostStore, session, NullLogger<PilotLoop>.Instance));
    }

    /// <summary>Saves the settings as an earlier run would have, then builds the host from disk.</summary>
    private void SavedBeforeRestart(PilotSettings settings)
    {
        store.Save(settings);
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

    private int CyclesSent => session.Actions.Count(a => a == "cycle");

    [Fact]
    public async Task StaysIdle_WhenThePilotIsNotSetUp()
    {
        await loop.StartAsync(CancellationToken.None);
        await Task.Delay(50, TestContext.Current.CancellationToken);

        Assert.Empty(session.Actions);
        Assert.False(loop.GetStatus().Paired);
    }

    [Fact]
    public async Task Pairing_RunsCycles_AndUnpairing_InterruptsTheTurnButKeepsTheSession()
    {
        await loop.StartAsync(CancellationToken.None);

        store.Save(Settings());
        await TestWait.Until(() => CyclesSent == 1);
        Assert.True(loop.GetStatus().Conducting);
        Assert.Equal("user-1", loop.GetStatus().UserId);

        store.Clear();
        await TestWait.Until(() => !loop.GetStatus().Conducting);
        await Task.Delay(50, TestContext.Current.CancellationToken);

        Assert.Equal(1, CyclesSent);
        Assert.Contains("interrupt", session.Actions);
        Assert.DoesNotContain("stop", session.Actions);
        Assert.False(loop.GetStatus().Paired);
    }

    [Fact]
    public async Task StaysAsleep_WithoutStartingTheAgent_WhileThereIsNoWork()
    {
        session.BlockSleep = true;
        session.TaskList = TaskList(sleep: 1800);
        await loop.StartAsync(CancellationToken.None);

        store.Save(Settings());

        await TestWait.Until(() => session.Actions.Contains("sleep:1800"));
        Assert.Equal(0, CyclesSent);
        Assert.DoesNotContain("start", session.Actions);
        Assert.Empty(session.Cycles);
        Assert.Equal([1800], session.IdleCycles);
    }

    [Fact]
    public async Task Wake_MidCycle_NeitherRestartsNorInterruptsTheTurn()
    {
        await loop.StartAsync(CancellationToken.None);
        store.Save(Settings());
        await TestWait.Until(() => session.Actions.Contains("wait"));

        loop.Wake(); // e.g. a question was answered mid-cycle
        await Task.Delay(50, TestContext.Current.CancellationToken);

        Assert.Equal(1, CyclesSent);
        Assert.DoesNotContain("interrupt", session.Actions);
    }

    [Fact]
    public async Task Wake_DuringTheInterCycleSleep_StartsTheNextCycleNow()
    {
        session.BlockSleep = true;
        session.TaskList = TaskList(tasks: 1, sleep: 3600);
        session.Signals.Enqueue(WaitResult.Finished("done"));
        await loop.StartAsync(CancellationToken.None);
        store.Save(Settings());
        await TestWait.Until(() => session.Actions.Contains("sleep:3600"));

        loop.Wake();

        await TestWait.Until(() => CyclesSent == 2);
        Assert.DoesNotContain("interrupt", session.Actions);
    }

    [Fact]
    public async Task Unpairing_DoesNotInterrupt_TheUsersOwnSessionOnTheOtherProvider()
    {
        session.RunningProvider = Provider.Codex;
        await loop.StartAsync(CancellationToken.None);
        store.Save(Settings());
        await TestWait.Until(() => session.Actions.Contains("sleep:5"));

        store.Clear();
        await Task.Delay(50, TestContext.Current.CancellationToken);

        Assert.DoesNotContain("interrupt", session.Actions);
    }

    [Fact]
    public async Task Resume_StartsACycleRightAway_WhenNoBreakIsOwed()
    {
        SavedBeforeRestart(Settings());

        await loop.StartAsync(CancellationToken.None);

        await TestWait.Until(() => CyclesSent == 1);
        Assert.Contains(PilotLoop.ResumeReport, session.Reports);
    }

    [Fact]
    public async Task Resume_WaitsOutAnOwedBreak_BeforeTheFirstCycle()
    {
        session.DefaultActivity = Activity(DateTimeOffset.UtcNow, Completed(3600));
        SavedBeforeRestart(Settings());

        await loop.StartAsync(CancellationToken.None);

        await TestWait.Until(() => CyclesSent == 1);
        Assert.Contains(session.Reports, r => r.StartsWith(PilotLoop.ResumeReport, StringComparison.Ordinal) && r.Contains("planned break"));
        var breakSleep = session.Actions.FindIndex(a => a.StartsWith("sleep:", StringComparison.Ordinal) && int.Parse(a["sleep:".Length..]) > 60);
        Assert.InRange(breakSleep, 0, session.Actions.IndexOf("cycle") - 1);
    }

    [Fact]
    public async Task GetStatus_ReportsTheLastCycle()
    {
        session.TaskList = TaskList(sleep: 3600);
        await loop.StartAsync(CancellationToken.None);

        store.Save(Settings());

        await TestWait.Until(() => loop.GetStatus().LastCycleStatus == "empty");
        Assert.NotNull(loop.GetStatus().LastCycleAt);
    }

    [Fact]
    public async Task BacksOff_WhileTheApiIsUnreachable_AndAWakeProbesAgain()
    {
        session.BlockSleep = true;
        session.DefaultActivity = null;
        await loop.StartAsync(CancellationToken.None);
        store.Save(Settings());

        await TestWait.Until(() => session.Actions.Any(a => a.StartsWith("sleep:", StringComparison.Ordinal)));
        Assert.Equal(0, CyclesSent);
        Assert.NotNull(store.Current);

        session.DefaultActivity = Activity();
        loop.Wake();

        await TestWait.Until(() => CyclesSent == 1);
    }
}

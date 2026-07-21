using JobPilot.Terminal.Pilot;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests;

public sealed class PilotCoordinatorTests : IDisposable
{
    private readonly TempDir temp = new();
    private readonly PilotStore store;
    private readonly FakePilotRuntime env = new() { BlockWhenScriptless = true };
    private readonly PilotCoordinator coordinator;

    public PilotCoordinatorTests()
    {
        store = new PilotStore(Path.Combine(temp.Root, "pilot.json"), NullLogger<PilotStore>.Instance);
        coordinator = new PilotCoordinator(store, env, NullLogger<PilotCoordinator>.Instance);
    }

    public void Dispose()
    {
        coordinator.Dispose();
        temp.Dispose();
    }

    [Fact]
    public async Task Coordinator_StaysIdle_WhenUnpaired()
    {
        await coordinator.StartAsync(CancellationToken.None);

        await Task.Delay(50);

        Assert.Empty(env.Actions);
        Assert.False(coordinator.BuildStatus().Conducting);
        Assert.False(coordinator.BuildStatus().Paired);

        await coordinator.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task Enable_StartsConducting_AndDisableStopsInjecting()
    {
        await coordinator.StartAsync(CancellationToken.None);

        store.Save(TestPairing.Create());
        coordinator.WakeUp();

        await TestWait.Until(() => env.Actions.Contains("inject-cycle"));
        Assert.True(coordinator.BuildStatus().Conducting);
        Assert.True(coordinator.BuildStatus().Enabled);

        store.SetEnabled(false);
        coordinator.WakeUp();

        await TestWait.Until(() => !coordinator.BuildStatus().Conducting);
        var injectsAtDisable = env.Actions.Count(a => a == "inject-cycle");

        // The paired session is left running, but the in-flight turn is interrupted so work actually stops.
        await Task.Delay(50);
        Assert.Equal(injectsAtDisable, env.Actions.Count(a => a == "inject-cycle"));
        Assert.Contains("interrupt", env.Actions);
        Assert.DoesNotContain("stop", env.Actions);
        Assert.True(coordinator.BuildStatus().Paired); // pairing is kept

        await coordinator.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task WakeUp_WhileStillEnabled_DoesNotReinjectOrInterruptTheLiveCycle()
    {
        await coordinator.StartAsync(CancellationToken.None);

        store.Save(TestPairing.Create());
        coordinator.WakeUp();
        await TestWait.Until(() => env.Actions.Contains("await")); // the first cycle is in-flight, blocked on the sentinel

        coordinator.WakeUp(); // e.g. a question was answered mid-cycle

        await Task.Delay(50);
        Assert.Equal(1, env.Actions.Count(a => a == "inject-cycle")); // the live turn is neither restarted...
        Assert.DoesNotContain("interrupt", env.Actions);              // ...nor aborted

        store.SetEnabled(false);
        coordinator.WakeUp();
        await coordinator.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task WakeUp_DuringTheInterCycleSleep_StartsTheNextCyclePromptly()
    {
        env.BlockSleep = true; // the inter-cycle sleep blocks until a wake or disable ends it
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(new PilotCycle(Guid.NewGuid(), PilotCycleStatus.Ok, 3600)));
        await coordinator.StartAsync(CancellationToken.None);

        store.Save(TestPairing.Create());
        coordinator.WakeUp();

        await TestWait.Until(() => env.Actions.Contains("sleep:3600")); // first cycle done, now sleeping out an hour
        Assert.Equal(1, env.Actions.Count(a => a == "inject-cycle"));

        coordinator.WakeUp(); // a question was answered during the sleep

        await TestWait.Until(() => env.Actions.Count(a => a == "inject-cycle") >= 2); // the next cycle starts at once
        Assert.DoesNotContain("interrupt", env.Actions);

        store.SetEnabled(false);
        coordinator.WakeUp();
        await coordinator.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task Disable_DoesNotInterrupt_WhilePausedOnProviderMismatch()
    {
        env.RunningProvider = "codex"; // the user drives the other provider; the pilot pairs claude
        await coordinator.StartAsync(CancellationToken.None);

        store.Save(TestPairing.Create());
        coordinator.WakeUp();
        await TestWait.Until(() => env.Actions.Contains("pause"));

        store.SetEnabled(false);
        coordinator.WakeUp();

        await TestWait.Until(() => !coordinator.BuildStatus().Enabled);
        await Task.Delay(50);
        Assert.DoesNotContain("interrupt", env.Actions);

        await coordinator.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task Resume_InjectsImmediately_WhenNoInterCycleSleepIsOwed()
    {
        store.Save(TestPairing.Create()); // paired + enabled persisted before the host process starts

        await coordinator.StartAsync(CancellationToken.None);

        // No WakeUp: a fresh host must resume on its own from the persisted pairing.
        await TestWait.Until(() => env.Actions.Contains("inject-cycle"));
        Assert.True(coordinator.BuildStatus().Conducting);
        Assert.Contains(PilotCoordinator.ResumeReport, env.Reports); // the plain report: no planned-break wording

        store.SetEnabled(false);
        coordinator.WakeUp();
        await coordinator.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task Resume_WaitsOutThePlannedBreak_WhenAnInterCycleSleepWasStillOwed()
    {
        // A cycle completed just before the restart announcing a long sleep; the remainder is honored before injecting.
        env.DefaultActivity = new PilotActivitySnapshot(
            DateTimeOffset.UtcNow,
            new PilotCompletedCycle(Guid.NewGuid().ToString(), DateTimeOffset.UtcNow, "ok", 3600));
        store.Save(TestPairing.Create());

        await coordinator.StartAsync(CancellationToken.None);

        await TestWait.Until(() => env.Actions.Contains("inject-cycle"));
        var report = env.Reports.First(r => r.StartsWith(PilotCoordinator.ResumeReport, StringComparison.Ordinal));
        Assert.Contains("planned break", report);
        // The remaining ~1h break is waited out (a long sleep) before the first inject.
        var breakSleep = env.Actions.FindIndex(a => a.StartsWith("sleep:", StringComparison.Ordinal)
            && int.Parse(a["sleep:".Length..]) > 60);
        Assert.InRange(breakSleep, 0, env.Actions.IndexOf("inject-cycle") - 1);

        store.SetEnabled(false);
        coordinator.WakeUp();
        await coordinator.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task BuildStatus_ReportsCycleOutcome()
    {
        await coordinator.StartAsync(CancellationToken.None);

        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(new PilotCycle(Guid.NewGuid(), PilotCycleStatus.Empty, 3600)));
        store.Save(TestPairing.Create());
        coordinator.WakeUp();

        await TestWait.Until(() => coordinator.BuildStatus().LastCycleStatus == "empty");
        Assert.NotNull(coordinator.BuildStatus().LastCycleAt);

        store.SetEnabled(false);
        coordinator.WakeUp();
        await coordinator.StopAsync(CancellationToken.None);
    }

    [Fact]
    public void WakeUp_CoalescesABurstIntoOnePendingPulse()
    {
        for (var i = 0; i < 100; i++)
        {
            coordinator.WakeUp();
        }

        Assert.Equal(100, coordinator.WakeCount);
        Assert.Equal(1, coordinator.PendingWakeCount);
    }
}

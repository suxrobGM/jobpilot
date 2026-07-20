using JobPilot.Terminal.Pilot;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests;

public sealed class PilotCoordinatorTests : IDisposable
{
    private readonly TempDir temp = new();
    private readonly PilotStore store;
    private readonly FakePilotRuntime env = new() { BlockWhenScriptless = true };
    private readonly PilotCoordinator conductor;

    public PilotCoordinatorTests()
    {
        store = new PilotStore(Path.Combine(temp.Root, "pilot.json"), NullLogger<PilotStore>.Instance);
        conductor = new PilotCoordinator(store, env, NullLogger<PilotCoordinator>.Instance);
    }

    public void Dispose()
    {
        conductor.Dispose();
        temp.Dispose();
    }

    [Fact]
    public async Task Conductor_StaysIdle_WhenUnpaired()
    {
        await conductor.StartAsync(CancellationToken.None);

        await Task.Delay(50);

        Assert.Empty(env.Actions);
        Assert.False(conductor.BuildStatus().Conducting);
        Assert.False(conductor.BuildStatus().Paired);

        await conductor.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task Enable_StartsConducting_AndDisableStopsInjecting()
    {
        await conductor.StartAsync(CancellationToken.None);

        store.Save(TestPairing.Create());
        conductor.WakeUp();

        await TestWait.Until(() => env.Actions.Contains("inject-cycle"));
        Assert.True(conductor.BuildStatus().Conducting);
        Assert.True(conductor.BuildStatus().Enabled);

        store.SetEnabled(false);
        conductor.WakeUp();

        await TestWait.Until(() => !conductor.BuildStatus().Conducting);
        var injectsAtDisable = env.Actions.Count(a => a == "inject-cycle");

        // The paired session is left running, but the in-flight turn is interrupted so work actually stops.
        await Task.Delay(50);
        Assert.Equal(injectsAtDisable, env.Actions.Count(a => a == "inject-cycle"));
        Assert.Contains("interrupt", env.Actions);
        Assert.DoesNotContain("stop", env.Actions);
        Assert.True(conductor.BuildStatus().Paired); // pairing is kept

        await conductor.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task WakeUp_WhileStillEnabled_DoesNotInterruptTheSession()
    {
        await conductor.StartAsync(CancellationToken.None);

        store.Save(TestPairing.Create());
        conductor.WakeUp();
        await TestWait.Until(() => env.Actions.Contains("await"));

        conductor.WakeUp(); // e.g. a question was answered; the cycle restarts but the turn is not aborted

        await TestWait.Until(() => env.Actions.Count(a => a == "inject-cycle") >= 2);
        Assert.DoesNotContain("interrupt", env.Actions);

        store.SetEnabled(false);
        conductor.WakeUp();
        await conductor.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task Disable_DoesNotInterrupt_WhilePausedOnProviderMismatch()
    {
        env.RunningProvider = "codex"; // the user drives the other provider; the pilot pairs claude
        await conductor.StartAsync(CancellationToken.None);

        store.Save(TestPairing.Create());
        conductor.WakeUp();
        await TestWait.Until(() => env.Actions.Contains("pause"));

        store.SetEnabled(false);
        conductor.WakeUp();

        await TestWait.Until(() => !conductor.BuildStatus().Enabled);
        await Task.Delay(50);
        Assert.DoesNotContain("interrupt", env.Actions);

        await conductor.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task Conductor_ResumesConducting_AtStartup_WithoutAWakeUp_WhenTheStoreIsEnabled()
    {
        store.Save(TestPairing.Create()); // paired + enabled persisted before the host process starts

        await conductor.StartAsync(CancellationToken.None);

        // No WakeUp: a fresh host must resume on its own from the persisted pairing.
        await TestWait.Until(() => env.Actions.Contains("inject-cycle"));
        Assert.True(conductor.BuildStatus().Conducting);
        Assert.Contains(PilotCoordinator.ResumeReport, env.Reports);

        store.SetEnabled(false);
        conductor.WakeUp();
        await conductor.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task BuildStatus_ReportsCycleOutcome()
    {
        await conductor.StartAsync(CancellationToken.None);

        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(new PilotCycle(Guid.NewGuid(), PilotCycleStatus.Empty, 3600)));
        store.Save(TestPairing.Create());
        conductor.WakeUp();

        await TestWait.Until(() => conductor.BuildStatus().LastCycleStatus == "empty");
        Assert.NotNull(conductor.BuildStatus().LastCycleAt);

        store.SetEnabled(false);
        conductor.WakeUp();
        await conductor.StopAsync(CancellationToken.None);
    }

    [Fact]
    public void WakeUp_CoalescesABurstIntoOnePendingPulse()
    {
        for (var i = 0; i < 100; i++)
        {
            conductor.WakeUp();
        }

        Assert.Equal(100, conductor.WakeCount);
        Assert.Equal(1, conductor.PendingWakeCount);
    }
}

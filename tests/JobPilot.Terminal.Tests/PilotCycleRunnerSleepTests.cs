using JobPilot.Terminal.Pilot;
using Xunit;
using static JobPilot.Terminal.Tests.RunnerTest;

namespace JobPilot.Terminal.Tests;

/// <summary>Cycle lifecycle: starting the session, returning the inter-cycle sleep, and session-exit handling.</summary>
public class PilotCycleRunnerSleepTests
{
    [Fact]
    public async Task RunIteration_StartsThenInjectsThenReturnsTheSleepOnSentinel()
    {
        var env = new FakePilotRuntime { RunningProvider = null };
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(30)));
        var loop = Runner(env);

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["start", "grace", "inject-cycle", "await"], env.Actions);
        Assert.Equal(TimeSpan.FromSeconds(30), sleep);
        Assert.Equal(0, loop.ConsecutiveTimeouts);
        Assert.Equal(PilotCycleStatus.Ok, loop.LastCycleStatus);
        Assert.NotNull(loop.LastCycleAt);
        Assert.True(loop.Conducting);
    }

    [Fact]
    public async Task RunIteration_SkipsStart_WhenThePairedProviderAlreadyRuns()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(60)));
        var loop = Runner(env);

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["inject-cycle", "await"], env.Actions);
        Assert.Equal(TimeSpan.FromSeconds(60), sleep);
    }

    [Fact]
    public async Task RunIteration_ReturnsTheClampedSleep_BelowTheFloorAndAboveTheCeiling()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(5)));      // below the floor
        var loop = Runner(env);

        var low = await loop.RunIterationAsync(Claude, CancellationToken.None);
        Assert.Equal(TimeSpan.FromSeconds(PilotCycleRunner.MinSleepSeconds), low);

        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(999999))); // above the ceiling
        var high = await loop.RunIterationAsync(Claude, CancellationToken.None);
        Assert.Equal(TimeSpan.FromSeconds(PilotCycleRunner.MaxSleepSeconds), high);
    }

    [Fact]
    public async Task RunIteration_PausesInsteadOfRestarting_WhenTheUserRunsAnotherProvider()
    {
        var env = new FakePilotRuntime { RunningProvider = "codex" };
        var loop = Runner(env);

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Null(sleep);
        Assert.Equal(["pause"], env.Actions);
        Assert.False(loop.Conducting);
        Assert.DoesNotContain("stop", env.Actions);
        Assert.DoesNotContain("inject-cycle", env.Actions);
    }

    [Fact]
    public async Task RunIteration_RestartsNextIteration_WhenTheSessionExitsMidWait()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Exited);
        var loop = Runner(env);

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        // No check-in and no restart: the session died on its own and simply restarts next pass.
        Assert.Null(sleep);
        Assert.Equal(["inject-cycle", "await"], env.Actions);
        Assert.Equal(0, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_ReportsAndBacksOff_AfterThreeConsecutiveSessionExits()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        var loop = Runner(env);

        for (var i = 0; i < PilotCycleRunner.BackoffThreshold - 1; i++)
        {
            env.SentinelResults.Enqueue(PilotWaitResult.Exited);
            await loop.RunIterationAsync(Claude, CancellationToken.None);
        }
        Assert.DoesNotContain("sleep:1800", env.Actions);
        Assert.DoesNotContain(PilotReports.ExitBackoff, env.Reports);

        env.SentinelResults.Enqueue(PilotWaitResult.Exited);
        await loop.RunIterationAsync(Claude, CancellationToken.None);

        // A CLI dying on every spawn must tell the user and back off instead of hot-looping restarts.
        Assert.Equal(1, env.Reports.Count(r => r == PilotReports.ExitBackoff));
        Assert.Equal("sleep:1800", env.Actions[^1]);
        Assert.Equal(0, loop.ConsecutiveSessionExits); // re-armed after the backoff
        Assert.Equal(0, loop.ConsecutiveTimeouts);     // exits are not restarts
    }

    [Fact]
    public async Task RunIteration_ResetsTheExitCount_AfterASuccessfulCycle()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        var loop = Runner(env);

        for (var i = 0; i < PilotCycleRunner.BackoffThreshold - 1; i++)
        {
            env.SentinelResults.Enqueue(PilotWaitResult.Exited);
            await loop.RunIterationAsync(Claude, CancellationToken.None);
        }
        Assert.Equal(PilotCycleRunner.BackoffThreshold - 1, loop.ConsecutiveSessionExits);

        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(30)));
        await loop.RunIterationAsync(Claude, CancellationToken.None); // a completed cycle breaks the run

        env.SentinelResults.Enqueue(PilotWaitResult.Exited);
        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(1, loop.ConsecutiveSessionExits);
        Assert.DoesNotContain(PilotReports.ExitBackoff, env.Reports);
    }
}

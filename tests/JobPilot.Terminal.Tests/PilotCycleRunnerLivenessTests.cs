using JobPilot.Terminal.Pilot;
using Xunit;
using static JobPilot.Terminal.Tests.RunnerTest;

namespace JobPilot.Terminal.Tests;

/// <summary>Liveness gating: a run the server still shows as active defers the ladder instead of being interrupted.</summary>
public class PilotCycleRunnerLivenessTests
{
    [Fact]
    public async Task RunIteration_ExtendsTheWait_WhenTheCycleTimesOutButActivityIsFresh()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", DefaultActivity = Live(Fresh) };
        env.SentinelResults.Enqueue(PilotWaitResult.Timeout);             // first budget lapses
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(20))); // the extended await catches the sentinel
        var loop = Runner(env);

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        // A second await instead of a check-in; no ladder intervention.
        Assert.Equal(["inject-cycle", "await", "await"], env.Actions);
        Assert.Equal(TimeSpan.FromSeconds(20), sleep);
        Assert.Equal([PilotReports.Extend], env.Reports);
        Assert.DoesNotContain(PilotReports.CheckIn, env.Reports);
        Assert.DoesNotContain("stop", env.Actions);
        Assert.Equal(0, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_ExtendsTheWait_WhenStuckFiresButActivityIsFresh()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", DefaultActivity = Live(Fresh) };
        env.SentinelResults.Enqueue(PilotWaitResult.Stuck);
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(45)));
        var loop = Runner(env);

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["inject-cycle", "await", "await"], env.Actions);
        Assert.Equal(TimeSpan.FromSeconds(45), sleep);
        Assert.Equal([PilotReports.Extend], env.Reports);
        Assert.DoesNotContain("inject-check-in", env.Actions);
    }

    [Fact]
    public async Task RunIteration_ClimbsTheLadder_WhenActivityIsStale()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", DefaultActivity = Live(Stale) };
        var loop = Runner(env); // every await times out

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Null(sleep);
        Assert.Equal(
            ["inject-cycle", "await", "inject-check-in", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.DoesNotContain(PilotReports.Extend, env.Reports);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_ClimbsTheLadder_WhenActivityIsNull()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" }; // DefaultActivity is null (probe fails)
        var loop = Runner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(
            ["inject-cycle", "await", "inject-check-in", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.DoesNotContain(PilotReports.Extend, env.Reports);
    }

    [Fact]
    public async Task RunIteration_ClimbsTheLadder_WhenTheActivityProbeThrows()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", ActivityThrows = true };
        var loop = Runner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        // A throwing probe falls open to the ladder exactly like a stale one.
        Assert.Equal(
            ["inject-cycle", "await", "inject-check-in", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.DoesNotContain(PilotReports.Extend, env.Reports);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_ClimbsTheLadder_WhenFreshButTheCycleCapIsExceeded()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", DefaultActivity = Live(Fresh) };
        var loop = Runner(env); // every await times out, so extension runs to the cap

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Null(sleep);
        // Two extension re-awaits (20 -> 40 -> 60) then the cap forces the check-in/skip/restart ladder.
        Assert.Equal(
            ["inject-cycle", "await", "await", "await", "inject-check-in", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.Equal(1, env.Reports.Count(r => r == PilotReports.Extend)); // journaled at most once per cycle
        Assert.Contains(PilotReports.Restart, env.Reports);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_ExtendsBeforeSkip_WhenActivityGoesFreshAfterTheCheckIn()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Stuck);               // initial stuck -> check-in
        env.SentinelResults.Enqueue(PilotWaitResult.Stuck);               // check-in grace stuck
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(30))); // extended await catches the sentinel
        env.ActivityResults.Enqueue(Live(Stale)); // prime baseline
        env.ActivityResults.Enqueue(Live(Stale)); // liveness after the initial stuck: still stale
        env.ActivityResults.Enqueue(Live(Stale)); // check-in rung guard: not advanced
        env.ActivityResults.Enqueue(Live(Fresh)); // liveness after the check-in stuck: fresh -> extend
        var loop = Runner(env);

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["inject-cycle", "await", "inject-check-in", "await", "await"], env.Actions);
        Assert.Equal(TimeSpan.FromSeconds(30), sleep);
        Assert.Equal([PilotReports.CheckIn, PilotReports.Extend], env.Reports);
        Assert.DoesNotContain("inject-skip", env.Actions);
    }
}

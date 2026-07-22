using JobPilot.Terminal.Pilot;
using Xunit;
using static JobPilot.Terminal.Tests.PilotCycleRunnerHarness;

namespace JobPilot.Terminal.Tests;

/// <summary>The check-in -> skip -> restart intervention ladder and its consecutive-restart backoff.</summary>
public class PilotCycleRunnerLadderTests
{
    [Fact]
    public async Task RunIteration_ChecksInThenSkipsThenRestarts_WhenTheCycleTimesOut()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        // No scripted results: all three awaits time out, climbing the full ladder.
        var loop = Runner(env);

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Null(sleep);
        Assert.Equal(
            ["inject-cycle", "await", "inject-check-in", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_ClimbsTheLadder_WhenStuckHeuristicsFireRepeatedly()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Stuck);
        env.SentinelResults.Enqueue(PilotWaitResult.Stuck);
        env.SentinelResults.Enqueue(PilotWaitResult.Stuck);
        var loop = Runner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(
            ["inject-cycle", "await", "inject-check-in", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.Equal([PilotReports.CheckIn, PilotReports.Skip, PilotReports.Restart], env.Reports);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_RecoversWithoutRestarting_WhenTheCheckInUnsticksTheAgent()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Timeout);             // first await times out
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(20))); // check-in unsticks it
        var loop = Runner(env);

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["inject-cycle", "await", "inject-check-in", "await"], env.Actions);
        Assert.Equal(TimeSpan.FromSeconds(20), sleep);
        Assert.Equal([PilotReports.CheckIn], env.Reports);
        Assert.Equal(0, loop.ConsecutiveTimeouts);
        Assert.DoesNotContain("stop", env.Actions);
    }

    [Fact]
    public async Task RunIteration_RecoversAtSkip_WhenTheSkipDirectiveUnsticksTheAgent()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Stuck);               // first stuck -> check-in
        env.SentinelResults.Enqueue(PilotWaitResult.Stuck);               // still stuck -> skip
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(45))); // skip unsticks it
        var loop = Runner(env);

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(
            ["inject-cycle", "await", "inject-check-in", "await", "inject-skip", "await"],
            env.Actions);
        Assert.Equal(TimeSpan.FromSeconds(45), sleep);
        Assert.Equal([PilotReports.CheckIn, PilotReports.Skip], env.Reports);
        Assert.DoesNotContain("stop", env.Actions);
        Assert.Equal(0, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_MixesTimeoutAndStuck_OnTheSameLadder()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Timeout); // cap lapses -> check-in
        env.SentinelResults.Enqueue(PilotWaitResult.Stuck);   // stuck -> skip
        // third await times out -> restart
        var loop = Runner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(
            ["inject-cycle", "await", "inject-check-in", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_ReportsCheckInSkipRestart_InOrder_WhenTheCycleStaysStuck()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        var loop = Runner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None); // all awaits time out

        Assert.Equal([PilotReports.CheckIn, PilotReports.Skip, PilotReports.Restart], env.Reports);
    }

    [Fact]
    public async Task RunIteration_StillClimbsTheLadder_WhenReportingThrows()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", ReportThrows = true };
        var loop = Runner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        // A failing journal push must not abort any intervention.
        Assert.Equal(
            ["inject-cycle", "await", "inject-check-in", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_ResetsTheRestartCount_AfterASuccessfulCycle()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        var loop = Runner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None); // times out, restarts
        Assert.Equal(1, loop.ConsecutiveTimeouts);

        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(30)));
        await loop.RunIterationAsync(Claude, CancellationToken.None); // completes
        Assert.Equal(0, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_BacksOff_AfterThreeConsecutiveRestarts()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", StartMakesRunning = true };
        var loop = Runner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
        Assert.DoesNotContain("sleep:1800", env.Actions);

        await loop.RunIterationAsync(Claude, CancellationToken.None);
        Assert.Equal(2, loop.ConsecutiveTimeouts);
        Assert.DoesNotContain("sleep:1800", env.Actions);

        env.ClearActions();
        await loop.RunIterationAsync(Claude, CancellationToken.None);
        Assert.Equal(3, loop.ConsecutiveTimeouts);
        Assert.Equal("sleep:1800", env.Actions[^1]); // 30-minute backoff after the third restart
    }

    [Fact]
    public async Task RunIteration_ReportsBackoff_OnlyOnTheThirdConsecutiveRestart()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", StartMakesRunning = true };
        var loop = Runner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);
        await loop.RunIterationAsync(Claude, CancellationToken.None);
        Assert.DoesNotContain(PilotReports.Backoff, env.Reports);

        await loop.RunIterationAsync(Claude, CancellationToken.None);
        Assert.Equal(1, env.Reports.Count(r => r == PilotReports.Backoff));
    }
}

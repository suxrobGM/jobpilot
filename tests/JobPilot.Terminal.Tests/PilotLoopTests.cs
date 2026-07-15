using JobPilot.Terminal.Pilot;
using Xunit;

namespace JobPilot.Terminal.Tests;

public class PilotLoopTests
{
    private static readonly PilotPairing Claude = new()
    {
        Provider = "claude",
        ApiToken = "tok",
        ApiUrl = "https://api",
        WebUrl = "https://web",
        Enabled = true,
    };

    private static PilotCycle Cycle(int sleep, PilotCycleStatus status = PilotCycleStatus.Ok) =>
        new(Guid.NewGuid(), status, sleep);

    [Fact]
    public async Task RunIteration_StartsThenInjectsThenSleepsOnSentinel()
    {
        var env = new FakePilotEnvironment { RunningProvider = null };
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(30)));
        var loop = new PilotLoop(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["start", "grace", "inject-cycle", "await", "sleep:30"], env.Actions);
        Assert.Equal(0, loop.ConsecutiveTimeouts);
        Assert.Equal(PilotCycleStatus.Ok, loop.LastCycleStatus);
        Assert.NotNull(loop.LastCycleAt);
        Assert.True(loop.Conducting);
    }

    [Fact]
    public async Task RunIteration_SkipsStart_WhenThePairedProviderAlreadyRuns()
    {
        var env = new FakePilotEnvironment { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(60)));
        var loop = new PilotLoop(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["inject-cycle", "await", "sleep:60"], env.Actions);
    }

    [Fact]
    public async Task RunIteration_ClampsTheSleepSeconds()
    {
        var env = new FakePilotEnvironment { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(5)));      // below the floor
        var loop = new PilotLoop(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);
        Assert.Contains("sleep:15", env.Actions);

        env.Actions.Clear();
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(999999))); // above the ceiling
        await loop.RunIterationAsync(Claude, CancellationToken.None);
        Assert.Contains("sleep:21600", env.Actions);
    }

    [Fact]
    public async Task RunIteration_NudgesThenKills_WhenTheCycleTimesOut()
    {
        var env = new FakePilotEnvironment { RunningProvider = "claude" };
        // No scripted results: both awaits time out.
        var loop = new PilotLoop(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["inject-cycle", "await", "inject-nudge", "await", "stop"], env.Actions);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_RecoversWithoutKilling_WhenTheNudgeUnsticksTheAgent()
    {
        var env = new FakePilotEnvironment { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Timeout);                     // first await times out
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(20)));         // nudge unsticks it
        var loop = new PilotLoop(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["inject-cycle", "await", "inject-nudge", "await", "sleep:20"], env.Actions);
        Assert.Equal(0, loop.ConsecutiveTimeouts);
        Assert.DoesNotContain("stop", env.Actions);
    }

    [Fact]
    public async Task RunIteration_RestartsNextIteration_WhenTheSessionExitsMidWait()
    {
        var env = new FakePilotEnvironment { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Exited);
        var loop = new PilotLoop(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        // No nudge and no kill: the session died on its own and simply restarts next pass.
        Assert.Equal(["inject-cycle", "await"], env.Actions);
        Assert.Equal(0, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_PausesInsteadOfKilling_WhenTheUserRunsAnotherProvider()
    {
        var env = new FakePilotEnvironment { RunningProvider = "codex" };
        var loop = new PilotLoop(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["pause"], env.Actions);
        Assert.False(loop.Conducting);
        Assert.DoesNotContain("stop", env.Actions);
        Assert.DoesNotContain("inject-cycle", env.Actions);
    }

    [Fact]
    public async Task RunIteration_BacksOff_AfterThreeConsecutiveWatchdogKills()
    {
        var env = new FakePilotEnvironment { RunningProvider = "claude", StartMakesRunning = true };
        var loop = new PilotLoop(env);

        // Every await times out, so each iteration kills the session.
        await loop.RunIterationAsync(Claude, CancellationToken.None);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
        Assert.DoesNotContain("sleep:1800", env.Actions);

        await loop.RunIterationAsync(Claude, CancellationToken.None);
        Assert.Equal(2, loop.ConsecutiveTimeouts);
        Assert.DoesNotContain("sleep:1800", env.Actions);

        env.Actions.Clear();
        await loop.RunIterationAsync(Claude, CancellationToken.None);
        Assert.Equal(3, loop.ConsecutiveTimeouts);
        Assert.Equal("sleep:1800", env.Actions[^1]); // 30-minute backoff after the third kill
    }

    [Fact]
    public async Task RunIteration_ResetsTheKillCount_AfterASuccessfulCycle()
    {
        var env = new FakePilotEnvironment { RunningProvider = "claude" };
        var loop = new PilotLoop(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None); // times out, kills
        Assert.Equal(1, loop.ConsecutiveTimeouts);

        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(30)));
        await loop.RunIterationAsync(Claude, CancellationToken.None); // completes
        Assert.Equal(0, loop.ConsecutiveTimeouts);
    }
}

using JobPilot.Terminal.Pilot;
using Xunit;

namespace JobPilot.Terminal.Tests;

public class PilotCycleRunnerTests
{
    private static readonly PilotPairing Claude = TestPairing.Create();

    private static PilotCycle Cycle(int sleep, PilotCycleStatus status = PilotCycleStatus.Ok) =>
        new(Guid.NewGuid(), status, sleep);

    private static DateTimeOffset Fresh => DateTimeOffset.UtcNow;
    private static DateTimeOffset Stale => DateTimeOffset.UtcNow - PilotCycleRunner.LivenessWindow - TimeSpan.FromMinutes(5);

    [Fact]
    public async Task RunIteration_PropagatesCancellationDuringTheActivityProbe()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", BlockActivity = true };
        var runner = new PilotCycleRunner(env);
        using var cts = new CancellationTokenSource();

        var iteration = runner.RunIterationAsync(Claude, cts.Token);
        await env.ActivityStarted.Task;
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => iteration);
        Assert.DoesNotContain("inject-nudge", env.Actions);
    }

    [Fact]
    public async Task RunIteration_PropagatesCancellationDuringAnInterventionReport()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", DefaultActivity = Stale, BlockReport = true };
        var runner = new PilotCycleRunner(env);
        using var cts = new CancellationTokenSource();

        var iteration = runner.RunIterationAsync(Claude, cts.Token);
        await env.ReportStarted.Task;
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => iteration);
        Assert.DoesNotContain("inject-nudge", env.Actions);
    }

    [Fact]
    public async Task RunIteration_ExtendsTheWait_WhenTheCycleTimesOutButActivityIsFresh()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", DefaultActivity = Fresh };
        env.SentinelResults.Enqueue(PilotWaitResult.Timeout);              // first cap lapses
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(20)));  // the extended await catches the sentinel
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        // A second await instead of a nudge; no ladder intervention.
        Assert.Equal(["inject-cycle", "await", "await", "sleep:20"], env.Actions);
        Assert.Equal([PilotCycleRunner.ExtendReport], env.Reports);
        Assert.DoesNotContain(PilotCycleRunner.NudgeReport, env.Reports);
        Assert.DoesNotContain("stop", env.Actions);
        Assert.Equal(0, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_ExtendsTheWait_WhenAStallFiresButActivityIsFresh()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", DefaultActivity = Fresh };
        env.SentinelResults.Enqueue(PilotWaitResult.Stalled);
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(45)));
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["inject-cycle", "await", "await", "sleep:45"], env.Actions);
        Assert.Equal([PilotCycleRunner.ExtendReport], env.Reports);
        Assert.DoesNotContain("inject-nudge", env.Actions);
    }

    [Fact]
    public async Task RunIteration_ClimbsTheLadder_WhenActivityIsStale()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", DefaultActivity = Stale };
        var loop = new PilotCycleRunner(env); // every await times out

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(
            ["inject-cycle", "await", "inject-nudge", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.DoesNotContain(PilotCycleRunner.ExtendReport, env.Reports);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_ClimbsTheLadder_WhenActivityIsNull()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" }; // DefaultActivity is null
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(
            ["inject-cycle", "await", "inject-nudge", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.DoesNotContain(PilotCycleRunner.ExtendReport, env.Reports);
    }

    [Fact]
    public async Task RunIteration_ClimbsTheLadder_WhenFreshButTheCycleCapIsExceeded()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", DefaultActivity = Fresh };
        var loop = new PilotCycleRunner(env); // every await times out, so extension runs to the cap

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        // Two extension re-awaits (20 -> 40 -> 60) then the cap forces the nudge/skip/kill ladder.
        Assert.Equal(
            ["inject-cycle", "await", "await", "await", "inject-nudge", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.Equal(1, env.Reports.Count(r => r == PilotCycleRunner.ExtendReport)); // journaled at most once per cycle
        Assert.Contains(PilotCycleRunner.KillReport, env.Reports);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_ClimbsTheLadder_WhenTheActivityProbeThrows()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", ActivityThrows = true };
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        // A throwing probe falls open to the ladder exactly like a stale one.
        Assert.Equal(
            ["inject-cycle", "await", "inject-nudge", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.DoesNotContain(PilotCycleRunner.ExtendReport, env.Reports);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_ProbesBeforeSkip_WhenActivityGoesFreshAfterTheNudge()
    {
        // Stale at the first probe (so the nudge fires), then fresh before the skip: the second probe extends.
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.ActivityResults.Enqueue(Stale);  // probe A: still stale -> nudge
        env.ActivityResults.Enqueue(Fresh);  // probe B (before skip): fresh -> extend
        env.SentinelResults.Enqueue(PilotWaitResult.Timeout);              // initial cap
        env.SentinelResults.Enqueue(PilotWaitResult.Timeout);              // nudge grace
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(30)));  // extended await catches the sentinel
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(
            ["inject-cycle", "await", "inject-nudge", "await", "await", "sleep:30"],
            env.Actions);
        Assert.Equal([PilotCycleRunner.NudgeReport, PilotCycleRunner.ExtendReport], env.Reports);
        Assert.DoesNotContain("inject-skip", env.Actions);
    }

    [Fact]
    public async Task RunIteration_StartsThenInjectsThenSleepsOnSentinel()
    {
        var env = new FakePilotRuntime { RunningProvider = null };
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(30)));
        var loop = new PilotCycleRunner(env);

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
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(60)));
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["inject-cycle", "await", "sleep:60"], env.Actions);
    }

    [Fact]
    public async Task RunIteration_ClampsTheSleepSeconds()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(5)));      // below the floor
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);
        Assert.Contains("sleep:15", env.Actions);

        env.Actions.Clear();
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(999999))); // above the ceiling
        await loop.RunIterationAsync(Claude, CancellationToken.None);
        Assert.Contains("sleep:21600", env.Actions);
    }

    [Fact]
    public async Task RunIteration_NudgesThenSkipsThenKills_WhenTheCycleTimesOut()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        // No scripted results: all three awaits time out, climbing the full ladder.
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(
            ["inject-cycle", "await", "inject-nudge", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_RecoversWithoutKilling_WhenTheNudgeUnsticksTheAgent()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Timeout);                     // first await times out
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(20)));         // nudge unsticks it
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["inject-cycle", "await", "inject-nudge", "await", "sleep:20"], env.Actions);
        Assert.Equal(0, loop.ConsecutiveTimeouts);
        Assert.DoesNotContain("stop", env.Actions);
    }

    [Fact]
    public async Task RunIteration_RestartsNextIteration_WhenTheSessionExitsMidWait()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Exited);
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        // No nudge and no kill: the session died on its own and simply restarts next pass.
        Assert.Equal(["inject-cycle", "await"], env.Actions);
        Assert.Equal(0, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_ReportsAndBacksOff_AfterThreeConsecutiveSessionExits()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        var loop = new PilotCycleRunner(env);

        for (var i = 0; i < PilotCycleRunner.BackoffThreshold - 1; i++)
        {
            env.SentinelResults.Enqueue(PilotWaitResult.Exited);
            await loop.RunIterationAsync(Claude, CancellationToken.None);
        }
        Assert.DoesNotContain("sleep:1800", env.Actions);
        Assert.DoesNotContain(PilotCycleRunner.ExitBackoffReport, env.Reports);

        env.SentinelResults.Enqueue(PilotWaitResult.Exited);
        await loop.RunIterationAsync(Claude, CancellationToken.None);

        // A CLI dying on every spawn must tell the user and back off instead of hot-looping restarts.
        Assert.Equal(1, env.Reports.Count(r => r == PilotCycleRunner.ExitBackoffReport));
        Assert.Equal("sleep:1800", env.Actions[^1]);
        Assert.Equal(0, loop.ConsecutiveSessionExits); // re-armed after the backoff
        Assert.Equal(0, loop.ConsecutiveTimeouts);     // exits are not watchdog kills
    }

    [Fact]
    public async Task RunIteration_ResetsTheExitCount_AfterASuccessfulCycle()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        var loop = new PilotCycleRunner(env);

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
        Assert.DoesNotContain(PilotCycleRunner.ExitBackoffReport, env.Reports);
    }

    [Fact]
    public async Task RunIteration_PausesInsteadOfKilling_WhenTheUserRunsAnotherProvider()
    {
        var env = new FakePilotRuntime { RunningProvider = "codex" };
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["pause"], env.Actions);
        Assert.False(loop.Conducting);
        Assert.DoesNotContain("stop", env.Actions);
        Assert.DoesNotContain("inject-cycle", env.Actions);
    }

    [Fact]
    public async Task RunIteration_BacksOff_AfterThreeConsecutiveWatchdogKills()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", StartMakesRunning = true };
        var loop = new PilotCycleRunner(env);

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
    public async Task RunIteration_ReportsNudgeThenKill_OnceEach_WhenTheCycleWedges()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None); // all awaits time out -> nudge, skip, kill

        Assert.Equal([PilotCycleRunner.NudgeReport, PilotCycleRunner.SkipReport, PilotCycleRunner.KillReport], env.Reports);
    }

    [Fact]
    public async Task RunIteration_ReportsOnlyTheNudge_WhenTheNudgeUnsticksTheAgent()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Timeout);
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(20)));
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal([PilotCycleRunner.NudgeReport], env.Reports);
    }

    [Fact]
    public async Task RunIteration_ReportsBackoff_OnTheThirdConsecutiveKill()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", StartMakesRunning = true };
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);
        await loop.RunIterationAsync(Claude, CancellationToken.None);
        Assert.DoesNotContain(PilotCycleRunner.BackoffReport, env.Reports);

        await loop.RunIterationAsync(Claude, CancellationToken.None);
        Assert.Equal(1, env.Reports.Count(r => r == PilotCycleRunner.BackoffReport)); // fires once, on the third kill
    }

    [Fact]
    public async Task RunIteration_StillNudgesAndKills_WhenReportingThrows()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", ReportThrows = true };
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        // A failing journal push must not abort any intervention.
        Assert.Equal(
            ["inject-cycle", "await", "inject-nudge", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_ResetsTheKillCount_AfterASuccessfulCycle()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None); // times out, kills
        Assert.Equal(1, loop.ConsecutiveTimeouts);

        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(30)));
        await loop.RunIterationAsync(Claude, CancellationToken.None); // completes
        Assert.Equal(0, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_ClimbsNudgeSkipKill_WhenStallHeuristicsFireRepeatedly()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Stalled);
        env.SentinelResults.Enqueue(PilotWaitResult.Stalled);
        env.SentinelResults.Enqueue(PilotWaitResult.Stalled);
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(
            ["inject-cycle", "await", "inject-nudge", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.Equal([PilotCycleRunner.NudgeReport, PilotCycleRunner.SkipReport, PilotCycleRunner.KillReport], env.Reports);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_RecoversAtSkip_WhenTheSkipDirectiveUnsticksTheAgent()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Stalled); // first stall -> nudge
        env.SentinelResults.Enqueue(PilotWaitResult.Stalled); // still stalled -> skip
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(45)));                 // skip unsticks it
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(
            ["inject-cycle", "await", "inject-nudge", "await", "inject-skip", "await", "sleep:45"],
            env.Actions);
        Assert.Equal([PilotCycleRunner.NudgeReport, PilotCycleRunner.SkipReport], env.Reports);
        Assert.DoesNotContain("stop", env.Actions);
        Assert.Equal(0, loop.ConsecutiveTimeouts);
    }

    [Fact]
    public async Task RunIteration_RecoversAtNudge_WhenAStallFiresThenTheNudgeUnsticksTheAgent()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Stalled);
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(20)));
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["inject-cycle", "await", "inject-nudge", "await", "sleep:20"], env.Actions);
        Assert.Equal([PilotCycleRunner.NudgeReport], env.Reports);
        Assert.DoesNotContain("inject-skip", env.Actions);
    }

    [Fact]
    public async Task RunIteration_MixesTimeoutAndStall_OnTheSameLadder()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Timeout);                              // cap lapses -> nudge
        env.SentinelResults.Enqueue(PilotWaitResult.Stalled);  // stalls -> skip
        // third await times out -> kill
        var loop = new PilotCycleRunner(env);

        await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(
            ["inject-cycle", "await", "inject-nudge", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.Equal(1, loop.ConsecutiveTimeouts);
    }
}

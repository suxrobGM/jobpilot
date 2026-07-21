using JobPilot.Terminal.Pilot;
using Xunit;
using static JobPilot.Terminal.Tests.RunnerTest;

namespace JobPilot.Terminal.Tests;

/// <summary>The server-reported completion fallback for when the TUI garbles the sentinel line.</summary>
public class PilotCycleRunnerCompletionTests
{
    [Fact]
    public async Task RunIteration_FinishesViaCompletionFallback_WhenASliceTimesOutButTheServerAdvanced()
    {
        // The TUI garbled the sentinel: the wait times out, but the server records a new completion.
        var env = new FakePilotRuntime { RunningProvider = "claude", DefaultActivity = Live(Stale, Completed(120)) };
        env.ActivityResults.Enqueue(Live(Stale)); // baseline: no completion yet
        var loop = Runner(env);

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["inject-cycle", "await"], env.Actions);
        Assert.Equal(TimeSpan.FromSeconds(120), sleep);
        Assert.Equal([PilotReports.Completion], env.Reports);
        Assert.DoesNotContain("inject-check-in", env.Actions);
    }

    [Fact]
    public async Task RunIteration_DefaultsToTheMinimumSleep_WhenACompletionCarriesNoSleepHint()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", DefaultActivity = Live(Stale, Completed(null)) };
        env.ActivityResults.Enqueue(Live(Stale)); // baseline: no completion yet
        var loop = Runner(env);

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(TimeSpan.FromSeconds(PilotCycleRunner.MinSleepSeconds), sleep);
        Assert.Equal([PilotReports.Completion], env.Reports);
    }

    [Fact]
    public async Task RunIteration_ConvertsARungIntoAFinish_WhenTheServerConfirmsCompletionBeforeSkipping()
    {
        // The check-in rung sees no completion, but the skip rung's guard does - so it finishes instead of skipping.
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.SentinelResults.Enqueue(PilotWaitResult.Stuck); // initial -> check-in
        env.SentinelResults.Enqueue(PilotWaitResult.Stuck); // check-in grace -> would skip
        env.ActivityResults.Enqueue(Live(Stale));                // prime baseline (no completion)
        env.ActivityResults.Enqueue(Live(Stale));                // liveness after the initial stuck
        env.ActivityResults.Enqueue(Live(Stale));                // check-in rung guard: not advanced
        env.ActivityResults.Enqueue(Live(Stale));                // liveness after the check-in stuck
        env.ActivityResults.Enqueue(Live(Stale, Completed(90))); // skip rung guard: advanced -> finish
        var loop = Runner(env);

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["inject-cycle", "await", "inject-check-in", "await"], env.Actions);
        Assert.Equal(TimeSpan.FromSeconds(90), sleep);
        Assert.Equal([PilotReports.CheckIn, PilotReports.Completion], env.Reports);
        Assert.DoesNotContain("inject-skip", env.Actions);
        Assert.DoesNotContain("stop", env.Actions);
    }

    [Fact]
    public async Task RunIteration_DoesNotDetectCompletion_WhenTheServerCycleEqualsTheBaseline()
    {
        // The baseline already carries this completion; an unchanged lastCycle must never read as a fresh cycle.
        var baseline = new PilotCompletedCycle(
            "11111111-1111-1111-1111-111111111111", new DateTimeOffset(2026, 7, 20, 0, 0, 0, TimeSpan.Zero), "ok", 120);
        var env = new FakePilotRuntime { RunningProvider = "claude", DefaultActivity = Live(Stale, baseline) };
        var loop = Runner(env);

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Null(sleep);
        Assert.Equal(
            ["inject-cycle", "await", "inject-check-in", "await", "inject-skip", "await", "stop"],
            env.Actions);
        Assert.DoesNotContain(PilotReports.Completion, env.Reports);
    }

    [Fact]
    public async Task RunIteration_UsesSentinelOnly_WhenTheBaselineProbeFails()
    {
        // A failed baseline probe disables the completion fallback for the cycle; the sentinel still ends it.
        var env = new FakePilotRuntime { RunningProvider = "claude", ActivityThrows = true };
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(30)));
        var loop = Runner(env);

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Equal(["inject-cycle", "await"], env.Actions);
        Assert.Equal(TimeSpan.FromSeconds(30), sleep);
        Assert.DoesNotContain(PilotReports.Completion, env.Reports);
    }

    [Fact]
    public async Task RunIteration_IgnoresAnOlderCompletion_WhenTheBaselineProbeFailsAfterAnEarlierCycle()
    {
        // Nothing refreshes the baseline when a cycle ends via its sentinel, so a failed baseline probe must not
        // leave the next cycle armed against the completion the previous one recorded.
        var env = new FakePilotRuntime { RunningProvider = "claude" };
        env.ActivityResults.Enqueue(Live(Stale, Completed(30))); // cycle 1 baseline
        env.SentinelResults.Enqueue(PilotWaitResult.Sentinel(Cycle(30)));
        var loop = Runner(env);
        await loop.RunIterationAsync(Claude, CancellationToken.None);

        env.Actions.Clear();
        env.ActivityResults.Enqueue(null);                    // cycle 2 baseline probe fails
        env.DefaultActivity = Live(Stale, Completed(900));    // server still shows cycle 1's completion

        var sleep = await loop.RunIterationAsync(Claude, CancellationToken.None);

        Assert.Null(sleep);
        Assert.DoesNotContain(PilotReports.Completion, env.Reports);
        Assert.Contains("inject-check-in", env.Actions);
    }

    [Fact]
    public async Task RunIteration_PropagatesCancellationDuringTheActivityProbe()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", BlockActivity = true };
        var runner = Runner(env);
        using var cts = new CancellationTokenSource();

        var iteration = runner.RunIterationAsync(Claude, cts.Token);
        await env.ActivityStarted.Task;
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => iteration);
        Assert.DoesNotContain("inject-check-in", env.Actions);
    }

    [Fact]
    public async Task RunIteration_PropagatesCancellationDuringAnInterventionReport()
    {
        var env = new FakePilotRuntime { RunningProvider = "claude", DefaultActivity = Live(Stale), BlockReport = true };
        var runner = Runner(env);
        using var cts = new CancellationTokenSource();

        var iteration = runner.RunIterationAsync(Claude, cts.Token);
        await env.ReportStarted.Task;
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => iteration);
        Assert.DoesNotContain("inject-check-in", env.Actions);
    }
}

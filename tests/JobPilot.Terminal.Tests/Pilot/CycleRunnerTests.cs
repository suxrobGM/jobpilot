using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Pilot.Api;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Tests.Support;
using Xunit;
using static JobPilot.Terminal.Tests.Support.Builders;

namespace JobPilot.Terminal.Tests.Pilot;

public class CycleRunnerTests
{
    [Fact]
    public async Task Run_StartsTheSession_HandsOverTheRun_AndRecordsItsResult()
    {
        var pilot = new FakePilot();
        pilot.Signals.Enqueue(WaitResult.Finished("done"));
        var runner = Runner(pilot);

        var sleep = await RunAsync(runner);

        Assert.Equal(["start", "sleep:15", "cycle", "wait"], pilot.Actions);
        Assert.Equal(TimeSpan.FromSeconds(30), sleep);
        Assert.Equal(["run-1/30"], pilot.Cycles);
        Assert.Empty(pilot.CancelledRuns);
        Assert.Equal(CycleStatus.Ok, runner.LastCycleStatus);
        Assert.True(runner.Conducting);
    }

    [Fact]
    public async Task Run_PostsTheRunsMeasuredUsage_OnlyWhenThereIsSome()
    {
        var measured = new FakePilot { Usage = new PilotUsage("claude-sonnet", 10, 5, 0, 0) };
        measured.Signals.Enqueue(WaitResult.Finished("done"));
        await RunAsync(Runner(measured));
        Assert.Equal(["run-1/claude-sonnet"], measured.UsageReports);

        var unmeasured = new FakePilot();
        unmeasured.Signals.Enqueue(WaitResult.Finished("done"));
        await RunAsync(Runner(unmeasured));
        Assert.Empty(unmeasured.UsageReports);
    }

    [Fact]
    public async Task Run_HoldsNewRuns_WhileTheUserTypes_AndSaysSoOnce()
    {
        var pilot = new FakePilot { LastUserInputAt = DateTimeOffset.UtcNow };
        var runner = Runner(pilot);

        var first = await RunAsync(runner);
        var second = await RunAsync(runner);

        Assert.DoesNotContain("cycle", pilot.Actions);
        Assert.InRange(first!.Value, TimeSpan.FromMinutes(2), CycleRunner.HoldWindow);
        Assert.NotNull(second);
        Assert.Equal([JournalLines.Hold], pilot.Reports);
        Assert.NotNull(runner.HeldUntil(DateTimeOffset.UtcNow));
    }

    [Fact]
    public async Task Run_StartsTheRun_OnceTheHoldHasPassed()
    {
        var pilot = new FakePilot { LastUserInputAt = DateTimeOffset.UtcNow - CycleRunner.HoldWindow };
        pilot.Signals.Enqueue(WaitResult.Finished("done"));
        var runner = Runner(pilot);

        await RunAsync(runner);

        Assert.Contains("cycle", pilot.Actions);
        Assert.Null(runner.HeldUntil(DateTimeOffset.UtcNow));
    }

    [Fact]
    public async Task Run_RecordsAFailedResultAsAnErrorCycle()
    {
        var pilot = new FakePilot { RunningProvider = Provider.Claude };
        pilot.Signals.Enqueue(WaitResult.Finished("failed"));
        var runner = Runner(pilot);

        Assert.Equal(TimeSpan.FromSeconds(30), await RunAsync(runner));
        Assert.Equal(["run-1/30"], pilot.Cycles);
        Assert.Equal(CycleStatus.Error, runner.LastCycleStatus);
    }

    [Fact]
    public async Task Run_RecordsAnIdleCheck_WithoutWakingTheAgent()
    {
        var pilot = new FakePilot { TaskList = TaskList(sleep: 1800) };
        var runner = Runner(pilot);

        var sleep = await RunAsync(runner);

        Assert.Empty(pilot.Actions);
        Assert.Equal(TimeSpan.FromSeconds(1800), sleep);
        Assert.Equal(["idle/1800"], pilot.Cycles);
        Assert.Equal(CycleStatus.Empty, runner.LastCycleStatus);
    }

    [Fact]
    public async Task Run_LeavesTheAgentAlone_WhenTheRefreshFailsOrTheStartIsRefused()
    {
        var pilot = new FakePilot { RunningProvider = Provider.Claude, TaskList = null };
        Assert.Equal(TimeSpan.FromMinutes(1), await RunAsync(Runner(pilot)));

        pilot.TaskList = TaskList(tasks: 1);
        pilot.StartedRunId = null;
        Assert.Equal(TimeSpan.FromSeconds(CycleSleep.MinSeconds), await RunAsync(Runner(pilot)));

        Assert.Empty(pilot.Actions);
        Assert.Empty(pilot.Cycles);
    }

    [Fact]
    public async Task Run_ClampsTheSleep_AndReusesARunningSession()
    {
        var pilot = new FakePilot { RunningProvider = Provider.Claude };
        var runner = Runner(pilot);

        pilot.TaskList = TaskList(tasks: 1, sleep: 5);
        pilot.Signals.Enqueue(WaitResult.Finished("done"));
        Assert.Equal(TimeSpan.FromSeconds(CycleSleep.MinSeconds), await RunAsync(runner));

        pilot.TaskList = TaskList(tasks: 1, sleep: 999999);
        pilot.Signals.Enqueue(WaitResult.Finished("done"));
        Assert.Equal(TimeSpan.FromSeconds(CycleSleep.MaxSeconds), await RunAsync(runner));
        Assert.DoesNotContain("start", pilot.Actions);
    }

    [Fact]
    public async Task Run_Pauses_WhenTheUserRunsTheOtherProvider()
    {
        var pilot = new FakePilot { RunningProvider = Provider.Codex };
        var runner = Runner(pilot);

        var sleep = await RunAsync(runner);

        Assert.Null(sleep);
        Assert.Equal(["sleep:5"], pilot.Actions);
        Assert.False(runner.Conducting);
    }

    [Fact]
    public async Task Run_Finishes_WhenThePolledRunHasFinished_EvenWithoutItsEvent()
    {
        var pilot = new FakePilot { RunningProvider = Provider.Claude };
        pilot.Run = new PilotRun("run-1", DateTimeOffset.UtcNow, "done");

        var sleep = await RunAsync(Runner(pilot));

        Assert.Equal(["cycle", "wait"], pilot.Actions);
        Assert.Equal(TimeSpan.FromSeconds(30), sleep);
        Assert.Equal(["run-1/30"], pilot.Cycles);
    }
}

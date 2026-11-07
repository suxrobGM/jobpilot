using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Providers;
using Xunit;
using static JobPilot.Terminal.Tests.Builders;

namespace JobPilot.Terminal.Tests;

public class CycleRunnerTests
{
    [Fact]
    public async Task Run_StartsTheSession_HandsOverTheRun_AndRecordsItsResult()
    {
        var session = new FakePilotSession();
        session.Signals.Enqueue(WaitResult.Finished("done"));
        var runner = Runner(session);

        var sleep = await RunAsync(runner);

        Assert.Equal(["start", "sleep:15", "cycle", "wait"], session.Actions);
        Assert.Equal(TimeSpan.FromSeconds(30), sleep);
        Assert.Equal(["run-1/30"], session.Cycles);
        Assert.Empty(session.CancelledRuns);
        Assert.Equal(CycleStatus.Ok, runner.LastCycleStatus);
        Assert.True(runner.Conducting);
    }

    [Fact]
    public async Task Run_HoldsNewRuns_WhileTheUserTypes_AndSaysSoOnce()
    {
        var session = new FakePilotSession { LastUserInputAt = DateTimeOffset.UtcNow };
        var runner = Runner(session);

        var first = await RunAsync(runner);
        var second = await RunAsync(runner);

        Assert.DoesNotContain("cycle", session.Actions);
        Assert.InRange(first!.Value, TimeSpan.FromMinutes(2), CycleRunner.HoldWindow);
        Assert.NotNull(second);
        Assert.Equal([CycleReports.Hold], session.Reports);
        Assert.NotNull(runner.HeldUntil(DateTimeOffset.UtcNow));
    }

    [Fact]
    public async Task Run_StartsTheRun_OnceTheHoldHasPassed()
    {
        var session = new FakePilotSession { LastUserInputAt = DateTimeOffset.UtcNow - CycleRunner.HoldWindow };
        session.Signals.Enqueue(WaitResult.Finished("done"));
        var runner = Runner(session);

        await RunAsync(runner);

        Assert.Contains("cycle", session.Actions);
        Assert.Null(runner.HeldUntil(DateTimeOffset.UtcNow));
    }

    [Fact]
    public async Task Run_RecordsAFailedResultAsAnErrorCycle()
    {
        var session = new FakePilotSession { RunningProvider = Provider.Claude };
        session.Signals.Enqueue(WaitResult.Finished("failed"));
        var runner = Runner(session);

        Assert.Equal(TimeSpan.FromSeconds(30), await RunAsync(runner));
        Assert.Equal(["run-1/30"], session.Cycles);
        Assert.Equal(CycleStatus.Error, runner.LastCycleStatus);
    }

    [Fact]
    public async Task Run_RecordsAnIdleCheck_WithoutWakingTheAgent()
    {
        var session = new FakePilotSession { TaskList = TaskList(sleep: 1800) };
        var runner = Runner(session);

        var sleep = await RunAsync(runner);

        Assert.Empty(session.Actions);
        Assert.Equal(TimeSpan.FromSeconds(1800), sleep);
        Assert.Equal(["idle/1800"], session.Cycles);
        Assert.Equal(CycleStatus.Empty, runner.LastCycleStatus);
    }

    [Fact]
    public async Task Run_LeavesTheAgentAlone_WhenTheRefreshFailsOrTheStartIsRefused()
    {
        var session = new FakePilotSession { RunningProvider = Provider.Claude, TaskList = null };
        Assert.Equal(TimeSpan.FromMinutes(1), await RunAsync(Runner(session)));

        session.TaskList = TaskList(tasks: 1);
        session.StartedRunId = null;
        Assert.Equal(TimeSpan.FromSeconds(CycleSleep.MinSeconds), await RunAsync(Runner(session)));

        Assert.Empty(session.Actions);
        Assert.Empty(session.Cycles);
    }

    [Fact]
    public async Task Run_ClampsTheSleep_AndReusesARunningSession()
    {
        var session = new FakePilotSession { RunningProvider = Provider.Claude };
        var runner = Runner(session);

        session.TaskList = TaskList(tasks: 1, sleep: 5);
        session.Signals.Enqueue(WaitResult.Finished("done"));
        Assert.Equal(TimeSpan.FromSeconds(CycleSleep.MinSeconds), await RunAsync(runner));

        session.TaskList = TaskList(tasks: 1, sleep: 999999);
        session.Signals.Enqueue(WaitResult.Finished("done"));
        Assert.Equal(TimeSpan.FromSeconds(CycleSleep.MaxSeconds), await RunAsync(runner));
        Assert.DoesNotContain("start", session.Actions);
    }

    [Fact]
    public async Task Run_Pauses_WhenTheUserRunsTheOtherProvider()
    {
        var session = new FakePilotSession { RunningProvider = Provider.Codex };
        var runner = Runner(session);

        var sleep = await RunAsync(runner);

        Assert.Null(sleep);
        Assert.Equal(["sleep:5"], session.Actions);
        Assert.False(runner.Conducting);
    }

    [Fact]
    public async Task Run_Finishes_WhenThePolledRunHasFinished_EvenWithoutItsEvent()
    {
        var session = new FakePilotSession { RunningProvider = Provider.Claude };
        session.Run = new PilotRun("run-1", DateTimeOffset.UtcNow, "done");

        var sleep = await RunAsync(Runner(session));

        Assert.Equal(["cycle", "wait"], session.Actions);
        Assert.Equal(TimeSpan.FromSeconds(30), sleep);
        Assert.Equal(["run-1/30"], session.Cycles);
    }
}

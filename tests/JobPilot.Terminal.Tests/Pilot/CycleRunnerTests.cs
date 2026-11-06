using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Providers;
using Xunit;
using static JobPilot.Terminal.Tests.Builders;
using Reports = JobPilot.Terminal.Pilot.CycleRunner.Reports;

namespace JobPilot.Terminal.Tests;

public class CycleRunnerTests
{
    private static readonly string[] FullLadder = ["cycle", "wait", "check-in", "wait", "skip", "wait", "stop"];

    // An interval at least as long as every wait makes each wait a single "wait" action.
    private static CycleRunner Runner(FakePilotSession session) => new(session, TimeSpan.FromMinutes(20));

    private static Task<TimeSpan?> RunAsync(CycleRunner runner, CancellationToken? ct = null) =>
        runner.RunAsync(Settings(), ct ?? TestContext.Current.CancellationToken);

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
        Assert.Equal([Reports.Hold], session.Reports);
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

    [Theory]
    [InlineData("skip cover letters", "skip cover letters")]
    [InlineData("line one\nline two\r\n", "line one line two")]
    [InlineData("\u001b[2Jclear\u0003", "[2Jclear")]
    public void SanitizeSteer_KeepsOneLineOfPlainText(string text, string expected)
    {
        Assert.Equal(expected, PilotSession.SanitizeSteer(text));
    }

    [Fact]
    public void SanitizeSteer_CapsTheLength()
    {
        Assert.Equal(1000, PilotSession.SanitizeSteer(new string('a', 5000)).Length);
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
        Assert.Equal(TimeSpan.FromSeconds(CycleRunner.MinSleepSeconds), await RunAsync(Runner(session)));

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
        Assert.Equal(TimeSpan.FromSeconds(CycleRunner.MinSleepSeconds), await RunAsync(runner));

        session.TaskList = TaskList(tasks: 1, sleep: 999999);
        session.Signals.Enqueue(WaitResult.Finished("done"));
        Assert.Equal(TimeSpan.FromSeconds(CycleRunner.MaxSleepSeconds), await RunAsync(runner));
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
    public async Task Run_CancelsTheRun_WhenTheSessionExitsMidWait()
    {
        var session = new FakePilotSession { RunningProvider = Provider.Claude };
        session.Signals.Enqueue(WaitResult.Exited);
        var runner = Runner(session);

        var sleep = await RunAsync(runner);

        Assert.Null(sleep);
        Assert.Equal(["cycle", "wait"], session.Actions);
        Assert.Equal(["run-1"], session.CancelledRuns);
        Assert.Equal(["run-1/30"], session.Cycles);
        Assert.Equal(0, runner.ConsecutiveRestarts);
    }

    [Fact]
    public async Task Run_BacksOff_OnlyAfterThreeExitsInARow()
    {
        var session = new FakePilotSession { RunningProvider = Provider.Claude };
        var runner = Runner(session);

        async Task Exit()
        {
            session.Signals.Enqueue(WaitResult.Exited);
            await RunAsync(runner);
        }

        await Exit();
        await Exit();
        session.Signals.Enqueue(WaitResult.Finished("done")); // a posted result breaks the streak
        await RunAsync(runner);
        await Exit();
        await Exit();
        Assert.DoesNotContain(Reports.ExitBackoff, session.Reports);

        await Exit();

        Assert.Equal([Reports.ExitBackoff], session.Reports);
        Assert.Equal("sleep:1800", session.Actions[^1]);
        Assert.Equal(0, runner.ConsecutiveExits);
    }

    [Theory]
    [InlineData(WaitOutcome.Timeout)]
    [InlineData(WaitOutcome.Stuck)]
    public async Task Run_ChecksInThenSkipsThenRestarts_AndCancelsTheRun_WhenItStaysStuck(WaitOutcome outcome)
    {
        var session = new FakePilotSession { RunningProvider = Provider.Claude };
        for (var i = 0; i < 3; i++)
        {
            session.Signals.Enqueue(new WaitResult(outcome));
        }

        var runner = Runner(session);

        var sleep = await RunAsync(runner);

        Assert.Null(sleep);
        Assert.Equal(FullLadder, session.Actions);
        Assert.Equal([Reports.CheckIn, Reports.Skip, Reports.Restart], session.Reports);
        Assert.Equal(["run-1"], session.CancelledRuns);
        Assert.Single(session.Cycles);
        Assert.Equal(1, runner.ConsecutiveRestarts);
    }

    [Fact]
    public async Task Run_Recovers_WhenACheckInOrSkipUnsticksTheAgent()
    {
        var checkedIn = new FakePilotSession { RunningProvider = Provider.Claude };
        checkedIn.Signals.Enqueue(WaitResult.Timeout);
        checkedIn.Signals.Enqueue(WaitResult.Finished("done"));

        Assert.Equal(TimeSpan.FromSeconds(30), await RunAsync(Runner(checkedIn)));
        Assert.Equal(["cycle", "wait", "check-in", "wait"], checkedIn.Actions);
        Assert.Equal([Reports.CheckIn], checkedIn.Reports);

        var skipped = new FakePilotSession { RunningProvider = Provider.Claude };
        skipped.Signals.Enqueue(WaitResult.Stuck);
        skipped.Signals.Enqueue(WaitResult.Stuck);
        skipped.Signals.Enqueue(WaitResult.Finished("failed"));

        Assert.Equal(TimeSpan.FromSeconds(30), await RunAsync(Runner(skipped)));
        Assert.Equal(["cycle", "wait", "check-in", "wait", "skip", "wait"], skipped.Actions);
        Assert.Equal([Reports.CheckIn, Reports.Skip], skipped.Reports);
        Assert.Empty(skipped.CancelledRuns);
    }

    [Fact]
    public async Task Run_BacksOff_OnTheThirdRestartInARow_AndAPostedResultResetsTheCount()
    {
        var session = new FakePilotSession { RunningProvider = Provider.Claude };
        var runner = Runner(session);

        await RunAsync(runner);
        session.Signals.Enqueue(WaitResult.Finished("done"));
        await RunAsync(runner);
        Assert.Equal(0, runner.ConsecutiveRestarts);

        await RunAsync(runner);
        await RunAsync(runner);
        Assert.DoesNotContain(Reports.Backoff, session.Reports);

        await RunAsync(runner);

        Assert.Equal(3, runner.ConsecutiveRestarts);
        Assert.Equal("sleep:1800", session.Actions[^1]);
        Assert.Single(session.Reports, r => r == Reports.Backoff);
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

    [Fact]
    public async Task Run_DoesNotCountStuckSignalsAsTime_WhileTheServerSeesActivity()
    {
        var session = new FakePilotSession { RunningProvider = Provider.Claude, DefaultActivity = Activity(Fresh) };
        for (var i = 0; i < 40; i++)
        {
            session.Signals.Enqueue(WaitResult.Stuck);
        }

        session.Signals.Enqueue(WaitResult.Finished("done"));

        var sleep = await RunAsync(Runner(session));

        // A noisy burst on a live run must never reach the cycle cap, nor announce an extension.
        Assert.Equal(TimeSpan.FromSeconds(30), sleep);
        Assert.DoesNotContain("check-in", session.Actions);
        Assert.Empty(session.Reports);
    }

    [Fact]
    public async Task Run_ExtendsWhileActive_ThenClimbsTheLadderPastTheCycleCap()
    {
        var session = new FakePilotSession { RunningProvider = Provider.Claude, DefaultActivity = Activity(Fresh) };

        var sleep = await RunAsync(Runner(session));

        // Two extensions (20 -> 40 -> 60 minutes), then the cap hands over to the ladder.
        Assert.Null(sleep);
        Assert.Equal(["cycle", "wait", "wait", "wait", "check-in", "wait", "skip", "wait", "stop"], session.Actions);
        Assert.Single(session.Reports, r => r == Reports.Extend);
    }

    [Fact]
    public async Task Run_KeepsWaitingBeforeSkip_WhenActivityResumesAfterTheCheckIn()
    {
        var session = new FakePilotSession { RunningProvider = Provider.Claude };
        session.Signals.Enqueue(WaitResult.Stuck);
        session.Signals.Enqueue(WaitResult.Stuck);
        session.Signals.Enqueue(WaitResult.Finished("done"));
        session.Activities.Enqueue(Activity(Stale)); // after the first stuck
        session.Activities.Enqueue(Activity(Fresh)); // after the second stuck: active again

        var sleep = await RunAsync(Runner(session));

        Assert.Equal(["cycle", "wait", "check-in", "wait", "wait"], session.Actions);
        Assert.Equal(TimeSpan.FromSeconds(30), sleep);
    }
}

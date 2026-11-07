using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Providers;
using Xunit;
using static JobPilot.Terminal.Tests.Builders;

namespace JobPilot.Terminal.Tests;

public class CycleRunnerStuckTests
{
    private static readonly string[] FullLadder = ["cycle", "wait", "check-in", "wait", "skip", "wait", "stop"];

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
        Assert.DoesNotContain(CycleReports.ExitBackoff, session.Reports);

        await Exit();

        Assert.Equal([CycleReports.ExitBackoff], session.Reports);
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
        Assert.Equal([CycleReports.CheckIn, CycleReports.Skip, CycleReports.Restart], session.Reports);
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
        Assert.Equal([CycleReports.CheckIn], checkedIn.Reports);

        var skipped = new FakePilotSession { RunningProvider = Provider.Claude };
        skipped.Signals.Enqueue(WaitResult.Stuck);
        skipped.Signals.Enqueue(WaitResult.Stuck);
        skipped.Signals.Enqueue(WaitResult.Finished("failed"));

        Assert.Equal(TimeSpan.FromSeconds(30), await RunAsync(Runner(skipped)));
        Assert.Equal(["cycle", "wait", "check-in", "wait", "skip", "wait"], skipped.Actions);
        Assert.Equal([CycleReports.CheckIn, CycleReports.Skip], skipped.Reports);
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
        Assert.DoesNotContain(CycleReports.Backoff, session.Reports);

        await RunAsync(runner);

        Assert.Equal(3, runner.ConsecutiveRestarts);
        Assert.Equal("sleep:1800", session.Actions[^1]);
        Assert.Single(session.Reports, r => r == CycleReports.Backoff);
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
        Assert.Single(session.Reports, r => r == CycleReports.Extend);
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

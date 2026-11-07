using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Tests.Support;
using Xunit;
using static JobPilot.Terminal.Tests.Support.Builders;

namespace JobPilot.Terminal.Tests.Pilot;

public class CycleRunnerStuckTests
{
    private static readonly string[] FullLadder = ["cycle", "wait", "check-in", "wait", "skip", "wait", "stop"];

    [Fact]
    public async Task Run_CancelsTheRun_WhenTheSessionExitsMidWait()
    {
        var pilot = new FakePilot { RunningProvider = Provider.Claude };
        pilot.Signals.Enqueue(WaitResult.Exited);
        var runner = Runner(pilot);

        var sleep = await RunAsync(runner);

        Assert.Null(sleep);
        Assert.Equal(["cycle", "wait"], pilot.Actions);
        Assert.Equal(["run-1"], pilot.CancelledRuns);
        Assert.Equal(["run-1/30"], pilot.Cycles);
        Assert.Equal(0, runner.ConsecutiveRestarts);
    }

    [Fact]
    public async Task Run_BacksOff_OnlyAfterThreeExitsInARow()
    {
        var pilot = new FakePilot { RunningProvider = Provider.Claude };
        var runner = Runner(pilot);

        async Task Exit()
        {
            pilot.Signals.Enqueue(WaitResult.Exited);
            await RunAsync(runner);
        }

        await Exit();
        await Exit();
        pilot.Signals.Enqueue(WaitResult.Finished("done")); // a posted result breaks the streak
        await RunAsync(runner);
        await Exit();
        await Exit();
        Assert.DoesNotContain(JournalLines.ExitBackoff, pilot.Reports);

        await Exit();

        Assert.Equal([JournalLines.ExitBackoff], pilot.Reports);
        Assert.Equal("sleep:1800", pilot.Actions[^1]);
        Assert.Equal(0, runner.ConsecutiveExits);
    }

    [Theory]
    [InlineData(WaitKind.Timeout)]
    [InlineData(WaitKind.Stuck)]
    public async Task Run_ChecksInThenSkipsThenRestarts_AndCancelsTheRun_WhenItStaysStuck(WaitKind outcome)
    {
        var pilot = new FakePilot { RunningProvider = Provider.Claude };
        for (var i = 0; i < 3; i++)
        {
            pilot.Signals.Enqueue(new WaitResult(outcome));
        }

        var runner = Runner(pilot);

        var sleep = await RunAsync(runner);

        Assert.Null(sleep);
        Assert.Equal(FullLadder, pilot.Actions);
        Assert.Equal([JournalLines.CheckIn, JournalLines.Skip, JournalLines.Restart], pilot.Reports);
        Assert.Equal(["run-1"], pilot.CancelledRuns);
        Assert.Single(pilot.Cycles);
        Assert.Equal(1, runner.ConsecutiveRestarts);
    }

    [Fact]
    public async Task Run_Recovers_WhenACheckInOrSkipUnsticksTheAgent()
    {
        var checkedIn = new FakePilot { RunningProvider = Provider.Claude };
        checkedIn.Signals.Enqueue(WaitResult.Timeout);
        checkedIn.Signals.Enqueue(WaitResult.Finished("done"));

        Assert.Equal(TimeSpan.FromSeconds(30), await RunAsync(Runner(checkedIn)));
        Assert.Equal(["cycle", "wait", "check-in", "wait"], checkedIn.Actions);
        Assert.Equal([JournalLines.CheckIn], checkedIn.Reports);

        var skipped = new FakePilot { RunningProvider = Provider.Claude };
        skipped.Signals.Enqueue(WaitResult.Stuck);
        skipped.Signals.Enqueue(WaitResult.Stuck);
        skipped.Signals.Enqueue(WaitResult.Finished("failed"));

        Assert.Equal(TimeSpan.FromSeconds(30), await RunAsync(Runner(skipped)));
        Assert.Equal(["cycle", "wait", "check-in", "wait", "skip", "wait"], skipped.Actions);
        Assert.Equal([JournalLines.CheckIn, JournalLines.Skip], skipped.Reports);
        Assert.Empty(skipped.CancelledRuns);
    }

    [Fact]
    public async Task Run_BacksOffOnce_OnTheThirdRestartInARow_AndAPostedResultResetsTheCount()
    {
        var pilot = new FakePilot { RunningProvider = Provider.Claude };
        var runner = Runner(pilot);

        await RunAsync(runner);
        pilot.Signals.Enqueue(WaitResult.Finished("done"));
        await RunAsync(runner);
        Assert.Equal(0, runner.ConsecutiveRestarts);

        await RunAsync(runner);
        await RunAsync(runner);
        Assert.DoesNotContain(JournalLines.Backoff, pilot.Reports);

        await RunAsync(runner);
        Assert.Equal(0, runner.ConsecutiveRestarts);
        Assert.Equal("sleep:1800", pilot.Actions[^1]);

        // The break re-arms the streak, so the next stuck run is not another 30 minutes.
        await RunAsync(runner);
        Assert.Single(pilot.Reports, r => r == JournalLines.Backoff);
    }

    [Fact]
    public async Task Run_DoesNotCountStuckSignalsAsTime_WhileTheServerSeesActivity()
    {
        var pilot = new FakePilot { RunningProvider = Provider.Claude, DefaultActivity = Activity(Fresh) };
        for (var i = 0; i < 40; i++)
        {
            pilot.Signals.Enqueue(WaitResult.Stuck);
        }

        pilot.Signals.Enqueue(WaitResult.Finished("done"));

        var sleep = await RunAsync(Runner(pilot));

        // A noisy burst on a live run must never reach the cycle cap, nor announce an extension.
        Assert.Equal(TimeSpan.FromSeconds(30), sleep);
        Assert.DoesNotContain("check-in", pilot.Actions);
        Assert.Empty(pilot.Reports);
    }

    [Fact]
    public async Task Run_ExtendsWhileActive_ThenClimbsTheLadderPastTheCycleCap()
    {
        var pilot = new FakePilot { RunningProvider = Provider.Claude, DefaultActivity = Activity(Fresh) };

        var sleep = await RunAsync(Runner(pilot));

        // Two extensions (20 -> 40 -> 60 minutes), then the cap hands over to the ladder.
        Assert.Null(sleep);
        Assert.Equal(["cycle", "wait", "wait", "wait", "check-in", "wait", "skip", "wait", "stop"], pilot.Actions);
        Assert.Single(pilot.Reports, r => r == JournalLines.Extend);
    }

    [Fact]
    public async Task Run_KeepsWaitingBeforeSkip_WhenActivityResumesAfterTheCheckIn()
    {
        var pilot = new FakePilot { RunningProvider = Provider.Claude };
        pilot.Signals.Enqueue(WaitResult.Stuck);
        pilot.Signals.Enqueue(WaitResult.Stuck);
        pilot.Signals.Enqueue(WaitResult.Finished("done"));
        pilot.Activities.Enqueue(Activity(Stale)); // after the first stuck
        pilot.Activities.Enqueue(Activity(Fresh)); // after the second stuck: active again

        var sleep = await RunAsync(Runner(pilot));

        Assert.Equal(["cycle", "wait", "check-in", "wait", "wait"], pilot.Actions);
        Assert.Equal(TimeSpan.FromSeconds(30), sleep);
    }
}

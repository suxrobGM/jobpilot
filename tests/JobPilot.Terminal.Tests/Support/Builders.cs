using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Pilot.Api;
using JobPilot.Terminal.Pilot.Pairing;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Sessions;
using JobPilot.Terminal.Sessions.Pty;
using Microsoft.Extensions.Logging.Abstractions;
using Pty.Net;
using Xunit;

namespace JobPilot.Terminal.Tests.Support;

internal static class Builders
{
    public static PilotPairing NewPairing(string apiUrl = "https://api", string apiToken = "tok") => new()
    {
        Provider = Provider.Claude,
        Api = Api with { Url = apiUrl, Token = apiToken },
        UserId = "user-1",
    };

    public static ApiConnection Api => new("https://api", "https://web", "tok");

    public static DateTimeOffset Fresh => DateTimeOffset.UtcNow;

    public static DateTimeOffset Stale => DateTimeOffset.UtcNow - CycleRunner.RecentActivityWindow - TimeSpan.FromMinutes(5);

    public static PilotActivity Activity(DateTimeOffset? at = null, CompletedCycle? lastCycle = null) =>
        new(at, lastCycle);

    public static CompletedCycle Completed(int? sleep) => new(DateTimeOffset.UtcNow, sleep);

    public static PilotTaskList TaskList(int tasks = 0, int sleep = 1800) =>
        new([.. Enumerable.Range(1, tasks).Select(i => new PilotTask($"t{i}"))], "v1", sleep);

    // An interval at least as long as every wait makes each wait a single "wait" action.
    public static CycleRunner Runner(FakePilot pilot) => new(pilot, pilot, pilot.Time, TimeSpan.FromMinutes(20));

    public static Task<TimeSpan?> RunAsync(CycleRunner runner) =>
        runner.RunAsync(NewPairing(), TestContext.Current.CancellationToken);

    public static PtyOptions SpawnOptions => new() { App = "claude", CommandLine = [], Cwd = ".", Cols = 80, Rows = 24 };

    /// <summary>A started process over the given fake connection.</summary>
    public static PtyProcess StartedPty(FakePtyConnection connection)
    {
        var process = new PtyProcess(SpawnOptions, _ => connection, NullLogger.Instance);
        process.Start();
        return process;
    }
}

using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Pilot.Api;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Sessions;
using JobPilot.Terminal.Sessions.Pty;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests.Support;

internal static class Builders
{
    public static PilotSettings Settings(string apiUrl = "https://api", string apiToken = "tok") => new()
    {
        Provider = Provider.Claude,
        Api = new ApiConnection(apiUrl, "https://web", apiToken),
        UserId = "user-1",
    };

    public static ApiConnection Api => new("https://api", "https://web", "tok");

    public static DateTimeOffset Fresh => DateTimeOffset.UtcNow;

    public static DateTimeOffset Stale => DateTimeOffset.UtcNow - CycleRunner.ActiveWindow - TimeSpan.FromMinutes(5);

    public static PilotActivity Activity(DateTimeOffset? at = null, CompletedCycle? lastCycle = null) =>
        new(at, lastCycle);

    public static CompletedCycle Completed(int? sleep) => new(DateTimeOffset.UtcNow, sleep);

    public static PilotTaskList TaskList(int tasks = 0, int sleep = 1800) =>
        new([.. Enumerable.Range(1, tasks).Select(i => new PilotTask($"t{i}", $"Task {i}"))], "v1", sleep);

    // An interval at least as long as every wait makes each wait a single "wait" action.
    public static CycleRunner Runner(FakePilotSession session) => new(session, TimeSpan.FromMinutes(20));

    public static Task<TimeSpan?> RunAsync(CycleRunner runner) =>
        runner.RunAsync(Settings(), TestContext.Current.CancellationToken);

    /// <summary>A started process over the given fake connection.</summary>
    public static PtyProcess StartedPty(FakePtyConnection connection)
    {
        var options = PtyProcess.BuildOptions("claude", [], ".", 80, 24, binDir: null, new Dictionary<string, string>());
        var process = new PtyProcess(options, _ => connection, NullLogger.Instance);
        process.Start();
        return process;
    }
}

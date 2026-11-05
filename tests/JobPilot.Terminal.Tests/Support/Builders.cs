using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Sessions;
using Microsoft.Extensions.Logging.Abstractions;

namespace JobPilot.Terminal.Tests;

internal static class Builders
{
    public static PilotSettings Settings(string apiUrl = "https://api", string apiToken = "tok") => new()
    {
        Provider = Provider.Claude,
        ApiToken = apiToken,
        ApiUrl = apiUrl,
        WebUrl = "https://web",
        UserId = "user-1",
    };

    public static DateTimeOffset Fresh => DateTimeOffset.UtcNow;

    public static DateTimeOffset Stale => DateTimeOffset.UtcNow - CycleRunner.ActiveWindow - TimeSpan.FromMinutes(5);

    public static PilotActivity Activity(DateTimeOffset? at = null, CompletedCycle? lastCycle = null) =>
        new(at, lastCycle);

    public static CompletedCycle Completed(int? sleep) => new(DateTimeOffset.UtcNow, sleep);

    public static PilotTaskList TaskList(int tasks = 0, int sleep = 1800) =>
        new([.. Enumerable.Range(1, tasks).Select(i => new PilotTask($"t{i}", $"Task {i}"))], "v1", sleep);

    /// <summary>A started process over the given fake connection.</summary>
    public static PtyProcess StartedPty(FakePtyConnection connection)
    {
        var options = PtyProcess.BuildOptions("claude", [], ".", 80, 24, binDir: null, new Dictionary<string, string>());
        var process = new PtyProcess(options, _ => connection, NullLogger.Instance);
        process.Start();
        return process;
    }
}

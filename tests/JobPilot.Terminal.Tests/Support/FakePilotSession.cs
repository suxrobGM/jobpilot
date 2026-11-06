using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Providers;

namespace JobPilot.Terminal.Tests;

internal sealed class FakePilotSession : IPilotSession
{
    // The loop records from a background thread while the test asserts, so the logs are read as snapshots.
    private readonly Lock sync = new();
    private readonly List<string> actions = [];
    private readonly List<string> reports = [];
    private readonly List<string> cycles = [];
    private readonly List<string> cancelledRuns = [];

    public List<string> Actions => Snapshot(actions);

    public List<string> Reports => Snapshot(reports);

    /// <summary>The recorded cycles, as "runId/sleep", or "idle/sleep" for a cycle without a run.</summary>
    public List<string> Cycles => Snapshot(cycles);

    public List<string> CancelledRuns => Snapshot(cancelledRuns);

    /// <summary>When the user last typed; null means never, so no hold.</summary>
    public DateTimeOffset? LastUserInputAt { get; set; }

    /// <summary>Null makes the server refuse the start.</summary>
    public string? StartedRunId { get; set; } = "run-1";

    /// <summary>Null by default: a failed read, so the run never looks finished.</summary>
    public PilotRun? Run { get; set; }

    public PilotTaskList? TaskList { get; set; } = Builders.TaskList(tasks: 1, sleep: 30);

    /// <summary>Results of successive waits; an empty queue times out.</summary>
    public Queue<WaitResult> Signals { get; } = new();

    /// <summary>Results of successive probes; an empty queue returns <see cref="DefaultActivity"/>.</summary>
    public Queue<PilotActivity?> Activities { get; } = new();

    /// <summary>Null by default: a failed probe, so no run looks active.</summary>
    public PilotActivity? DefaultActivity { get; set; }

    /// <summary>Blocks delays over a minute until cancelled, like a real inter-cycle sleep.</summary>
    public bool BlockSleep { get; set; }

    /// <summary>Blocks a wait with nothing scripted until cancelled, instead of timing out.</summary>
    public bool BlockWhenUnscripted { get; set; }

    public Provider? RunningProvider { get; set; }

    public void Start(PilotSettings settings)
    {
        Record("start");
        RunningProvider = settings.Provider;
    }

    public Task SendCycleAsync(PilotSettings settings, string runId, CancellationToken ct)
    {
        Record("cycle");
        return Task.CompletedTask;
    }

    public Task SendDirectiveAsync(PilotSettings settings, Directive directive, CancellationToken ct)
    {
        Record(directive == Directive.CheckIn ? "check-in" : "skip");
        return Task.CompletedTask;
    }

    public async Task<WaitResult> WaitForSignalAsync(TimeSpan timeout, CancellationToken ct)
    {
        Record("wait");
        if (Signals.TryDequeue(out var result))
        {
            return result;
        }

        if (BlockWhenUnscripted)
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, ct);
        }

        return WaitResult.Timeout;
    }

    public void Stop()
    {
        Record("stop");
        RunningProvider = null;
    }

    public void Interrupt() => Record("interrupt");

    public async Task DelayAsync(TimeSpan duration, CancellationToken ct)
    {
        Record($"sleep:{(int)duration.TotalSeconds}");
        if (BlockSleep && duration > TimeSpan.FromMinutes(1))
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, ct);
        }
    }

    public Task<PilotActivity?> GetActivityAsync(CancellationToken ct)
    {
        lock (sync)
        {
            return Task.FromResult(Activities.Count > 0 ? Activities.Dequeue() : DefaultActivity);
        }
    }

    public Task ReportAsync(string summary, CancellationToken ct)
    {
        lock (sync)
        {
            reports.Add(summary);
        }

        return Task.CompletedTask;
    }

    public Task<PilotTaskList?> RefreshTasksAsync(CancellationToken ct) => Task.FromResult(TaskList);

    public Task<string?> StartRunAsync(string taskId, string taskListVersion, CancellationToken ct) =>
        Task.FromResult(StartedRunId);

    public Task<PilotRun?> GetRunAsync(string runId, CancellationToken ct) => Task.FromResult(Run);

    public Task CancelRunAsync(string runId, CancellationToken ct)
    {
        lock (sync)
        {
            cancelledRuns.Add(runId);
        }

        return Task.CompletedTask;
    }

    public Task RecordCycleAsync(string? runId, int sleepSeconds, CancellationToken ct)
    {
        lock (sync)
        {
            cycles.Add($"{runId ?? "idle"}/{sleepSeconds}");
        }

        return Task.CompletedTask;
    }

    private void Record(string action)
    {
        lock (sync)
        {
            actions.Add(action);
        }
    }

    private List<string> Snapshot(List<string> list)
    {
        lock (sync)
        {
            return [.. list];
        }
    }
}

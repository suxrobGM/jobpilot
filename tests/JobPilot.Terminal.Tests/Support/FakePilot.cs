using JobPilot.Terminal.Pilot.Agent;
using JobPilot.Terminal.Pilot.Api;
using JobPilot.Terminal.Pilot.Pairing;
using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Providers;

namespace JobPilot.Terminal.Tests.Support;

/// <summary>Both of the loop's seams in one script, so a test reads the terminal, API and clock calls in order.</summary>
internal sealed class FakePilot : IPilotAgent, IPilotApi
{
    // The loop records from a background thread while the test asserts, so the logs are read as snapshots.
    private readonly Lock sync = new();
    private readonly List<string> actions = [];
    private readonly List<string> reports = [];
    private readonly List<string> cycles = [];
    private readonly List<string> cancelledRuns = [];
    private readonly List<string> usageReports = [];
    private string? handedOverRun;
    private string? endedRun;

    public FakePilot() => Time = new FakeTime(this);

    /// <summary>Delays log as "sleep:N" in <see cref="Actions"/> and finish at once, unless <see cref="BlockSleep"/>.</summary>
    public TimeProvider Time { get; }

    public List<string> Actions => Snapshot(actions);

    public List<string> Reports => Snapshot(reports);

    /// <summary>The recorded cycles, as "runId/sleep" after a run ended, or "idle/sleep" for a cycle without one.</summary>
    public List<string> Cycles => Snapshot(cycles);

    public List<string> CancelledRuns => Snapshot(cancelledRuns);

    /// <summary>Posted usage, as "runId/model".</summary>
    public List<string> UsageReports => Snapshot(usageReports);

    /// <summary>When the user last typed; null means never, so no hold.</summary>
    public DateTimeOffset? LastUserInputAt { get; set; }

    /// <summary>Null makes the server refuse the start.</summary>
    public string? StartedRunId { get; set; } = "run-1";

    /// <summary>Null by default: a failed read, so the run never looks finished.</summary>
    public PilotRun? Run { get; set; }

    public PilotTaskList? TaskList { get; set; } = Builders.TaskList(tasks: 1, sleep: 30);

    /// <summary>What ending a run measured; null means nothing.</summary>
    public PilotUsage? Usage { get; set; }

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

    public void Start(PilotPairing pairing)
    {
        Record("start");
        RunningProvider = pairing.Provider;
    }

    public Task SendCycleAsync(PilotPairing pairing, string runId, CancellationToken ct)
    {
        Record("cycle");
        lock (sync)
        {
            handedOverRun = runId;
        }

        return Task.CompletedTask;
    }

    public Task SendDirectiveAsync(PilotPairing pairing, Directive directive, CancellationToken ct)
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

    public void AbortTurn() => Record("abort-turn");

    public Task<PilotUsage?> EndRunAsync(CancellationToken ct)
    {
        lock (sync)
        {
            endedRun = handedOverRun;
            handedOverRun = null;
        }

        return Task.FromResult(Usage);
    }

    public void OnRunFinished(string runId, string outcome) => Record($"finished:{runId}:{outcome}");

    public Task StopRunAsync(string runId, CancellationToken ct)
    {
        Record($"stop:{runId}");
        return Task.CompletedTask;
    }

    public Task SteerRunAsync(string runId, string text, CancellationToken ct)
    {
        Record($"steer:{runId}:{text}");
        return Task.CompletedTask;
    }

    public Task<PilotActivity?> GetActivityAsync(CancellationToken ct)
    {
        lock (sync)
        {
            return Task.FromResult(Activities.Count > 0 ? Activities.Dequeue() : DefaultActivity);
        }
    }

    public Task WriteJournalAsync(string summary, CancellationToken ct)
    {
        lock (sync)
        {
            reports.Add(summary);
        }

        return Task.CompletedTask;
    }

    public Task<PilotTaskList?> RefreshTasksAsync(CancellationToken ct) => Task.FromResult(TaskList);

    public Task<PilotRun?> StartRunAsync(string taskId, string taskListVersion, CancellationToken ct) =>
        Task.FromResult(StartedRunId is { } id ? new PilotRun(id, null, null) : null);

    public Task<PilotRun?> GetRunAsync(string runId, CancellationToken ct) => Task.FromResult(Run);

    public Task CancelRunAsync(string runId, CancellationToken ct)
    {
        lock (sync)
        {
            cancelledRuns.Add(runId);
        }

        return Task.CompletedTask;
    }

    public Task ReportUsageAsync(string runId, PilotUsage usage, CancellationToken ct)
    {
        lock (sync)
        {
            usageReports.Add($"{runId}/{usage.Model}");
        }

        return Task.CompletedTask;
    }

    public Task PostStepsAsync(string runId, PilotStep[] steps, CancellationToken ct) => Task.CompletedTask;

    public Task<HttpResponseMessage?> OpenEventsAsync(PilotPairing pairing, CancellationToken ct) =>
        Task.FromResult<HttpResponseMessage?>(null);

    public Task RecordCycleAsync(int sleepSeconds, CancellationToken ct)
    {
        lock (sync)
        {
            cycles.Add($"{endedRun ?? "idle"}/{sleepSeconds}");
            endedRun = null;
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

    // Reads real time, so the builders' fresh and stale stamps keep their meaning.
    private sealed class FakeTime(FakePilot pilot) : TimeProvider
    {
        private static readonly TimeSpan MaxUnblockedSleep = TimeSpan.FromMinutes(1);

        public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period)
        {
            pilot.Record($"sleep:{(int)dueTime.TotalSeconds}");
            if (!pilot.BlockSleep || dueTime <= MaxUnblockedSleep)
            {
                ThreadPool.QueueUserWorkItem(_ => callback(state));
            }

            return new IdleTimer();
        }

        private sealed class IdleTimer : ITimer
        {
            public bool Change(TimeSpan dueTime, TimeSpan period) => true;

            public void Dispose()
            {
            }

            public ValueTask DisposeAsync() => ValueTask.CompletedTask;
        }
    }
}

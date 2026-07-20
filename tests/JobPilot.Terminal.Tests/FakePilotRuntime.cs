using JobPilot.Terminal.Pilot;

namespace JobPilot.Terminal.Tests;

/// <summary>Scriptable <see cref="IPilotRuntime"/> that records the actions the loop drives.</summary>
internal sealed class FakePilotRuntime : IPilotRuntime
{
    public List<string> Actions { get; } = [];

    /// <summary>Journal summaries passed to ReportSystemAsync, kept apart from Actions so sequence asserts stay stable.</summary>
    public List<string> Reports { get; } = [];

    /// <summary>When true, ReportSystemAsync throws after recording, to prove a failed report never breaks a cycle.</summary>
    public bool ReportThrows { get; set; }

    public bool BlockReport { get; set; }

    public TaskCompletionSource ReportStarted { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

    /// <summary>Results returned by successive AwaitSentinelAsync calls; empty dequeues to a timeout.</summary>
    public Queue<PilotWaitResult> SentinelResults { get; } = new();

    /// <summary>
    /// Activity timestamps returned by successive GetLastActivityAsync calls; empty dequeues to
    /// <see cref="DefaultActivity"/> (null by default, so the old ladder behavior stands). Probes are kept out of
    /// <see cref="Actions"/> so existing sequence asserts remain stable.
    /// </summary>
    public Queue<DateTimeOffset?> ActivityResults { get; } = new();

    /// <summary>Value returned by GetLastActivityAsync once <see cref="ActivityResults"/> is drained.</summary>
    public DateTimeOffset? DefaultActivity { get; set; }

    /// <summary>When true, GetLastActivityAsync throws, to prove a failed probe falls open to the ladder.</summary>
    public bool ActivityThrows { get; set; }

    public bool BlockActivity { get; set; }

    public TaskCompletionSource ActivityStarted { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

    public string? RunningProvider { get; set; }

    /// <summary>Whether StartSession marks the session running (mirrors a successful spawn).</summary>
    public bool StartMakesRunning { get; set; } = true;

    /// <summary>When true, a scriptless await blocks until the token cancels, then throws.</summary>
    public bool BlockWhenScriptless { get; set; }

    public void StartSession(PilotPairing pairing)
    {
        Actions.Add("start");
        if (StartMakesRunning)
        {
            RunningProvider = pairing.Provider;
        }
    }

    public Task WaitStartupGraceAsync(CancellationToken ct)
    {
        Actions.Add("grace");
        return Task.CompletedTask;
    }

    public Task InjectCycleAsync(PilotPairing pairing, CancellationToken ct)
    {
        Actions.Add("inject-cycle");
        return Task.CompletedTask;
    }

    public Task InjectNudgeAsync(PilotPairing pairing, CancellationToken ct)
    {
        Actions.Add("inject-nudge");
        return Task.CompletedTask;
    }

    public Task InjectSkipAsync(PilotPairing pairing, CancellationToken ct)
    {
        Actions.Add("inject-skip");
        return Task.CompletedTask;
    }

    public Task<PilotWaitResult> AwaitSentinelAsync(TimeSpan timeout, CancellationToken ct)
    {
        Actions.Add("await");
        if (SentinelResults.Count > 0)
        {
            return Task.FromResult(SentinelResults.Dequeue());
        }
        return BlockWhenScriptless ? WaitForCancelAsync(ct) : Task.FromResult(PilotWaitResult.Timeout);
    }

    public Task SleepAsync(TimeSpan duration, CancellationToken ct)
    {
        Actions.Add($"sleep:{(int)duration.TotalSeconds}");
        return Task.CompletedTask;
    }

    public void StopSession()
    {
        Actions.Add("stop");
        RunningProvider = null;
    }

    public void InterruptSession()
    {
        Actions.Add("interrupt");
    }

    public Task PauseAsync(CancellationToken ct)
    {
        Actions.Add("pause");
        return Task.CompletedTask;
    }

    public async Task ReportSystemAsync(string summary, CancellationToken ct)
    {
        Reports.Add(summary);
        ReportStarted.TrySetResult();
        if (BlockReport)
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, ct);
        }
        if (ReportThrows)
        {
            throw new InvalidOperationException("simulated journal failure");
        }
    }

    public async Task<DateTimeOffset?> GetLastActivityAsync(CancellationToken ct)
    {
        ActivityStarted.TrySetResult();
        if (BlockActivity)
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, ct);
        }
        if (ActivityThrows)
        {
            throw new InvalidOperationException("simulated activity probe failure");
        }
        return ActivityResults.Count > 0 ? ActivityResults.Dequeue() : DefaultActivity;
    }

    private static async Task<PilotWaitResult> WaitForCancelAsync(CancellationToken ct)
    {
        var tcs = new TaskCompletionSource<PilotWaitResult>(TaskCreationOptions.RunContinuationsAsynchronously);
        await using var reg = ct.Register(() => tcs.TrySetCanceled(ct));
        return await tcs.Task;
    }
}

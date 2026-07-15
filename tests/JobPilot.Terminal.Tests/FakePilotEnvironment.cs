using JobPilot.Terminal.Pilot;

namespace JobPilot.Terminal.Tests;

/// <summary>Scriptable <see cref="IPilotEnvironment"/> that records the actions the loop drives.</summary>
internal sealed class FakePilotEnvironment : IPilotEnvironment
{
    public List<string> Actions { get; } = [];

    /// <summary>Journal summaries passed to ReportSystemAsync, kept apart from Actions so sequence asserts stay stable.</summary>
    public List<string> Reports { get; } = [];

    /// <summary>When true, ReportSystemAsync throws after recording, to prove a failed report never breaks a cycle.</summary>
    public bool ReportThrows { get; set; }

    /// <summary>Results returned by successive AwaitSentinelAsync calls; empty dequeues to a timeout.</summary>
    public Queue<PilotWaitResult> SentinelResults { get; } = new();

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

    public Task PauseAsync(CancellationToken ct)
    {
        Actions.Add("pause");
        return Task.CompletedTask;
    }

    public Task ReportSystemAsync(string summary)
    {
        Reports.Add(summary);
        if (ReportThrows)
        {
            throw new InvalidOperationException("simulated journal failure");
        }
        return Task.CompletedTask;
    }

    private static async Task<PilotWaitResult> WaitForCancelAsync(CancellationToken ct)
    {
        var tcs = new TaskCompletionSource<PilotWaitResult>(TaskCreationOptions.RunContinuationsAsynchronously);
        await using var reg = ct.Register(() => tcs.TrySetCanceled(ct));
        return await tcs.Task;
    }
}

using JobPilot.Terminal.Contracts;
using Microsoft.Extensions.Hosting;

namespace JobPilot.Terminal.Pilot;

/// <summary>
/// Background loop that keeps re-injecting the pilot skill while pilot mode is enabled and recovers a wedged
/// session. Reacts to enable/disable without a host restart via <see cref="WakeUp"/>.
/// </summary>
public sealed class PilotConductor(PilotStore store, IPilotEnvironment env, ILogger<PilotConductor> logger) : BackgroundService
{
    private static readonly TimeSpan ErrorBackoff = TimeSpan.FromSeconds(30);

    // A restarted host waits this long before its first resumed cycle so Kestrel finishes binding first.
    private static readonly TimeSpan StartupResumeDelay = TimeSpan.FromSeconds(10);

    /// <summary>Journal summary pushed when a restarted host resumes conducting on its own.</summary>
    public const string ResumeReport = "Pilot conductor resumed after host restart.";

    private readonly PilotLoop loop = new PilotLoop(env);

    // Released to start from idle or to interrupt a running iteration when the pairing changes.
    private readonly SemaphoreSlim wake = new(0);
    private readonly Lock ctsGate = new();
    private CancellationTokenSource? iterationCts;
    private volatile bool driving;
    private volatile bool eventStreamConnected;

    private int wakeCount;

    /// <summary>Count of wake signals received; a test seam to observe event-driven wakes.</summary>
    internal int WakeCount => Volatile.Read(ref wakeCount);

    /// <summary>Signals the loop to re-read the pairing (after enable/disable).</summary>
    public void WakeUp()
    {
        Interlocked.Increment(ref wakeCount);
        wake.Release();
        lock (ctsGate)
        {
            iterationCts?.Cancel();
        }
    }

    /// <summary>Records whether the SSE event stream is currently connected, for /healthz. Set by the listener.</summary>
    public void SetEventStreamConnected(bool connected) => eventStreamConnected = connected;

    /// <summary>Snapshot of pilot state for /healthz.</summary>
    public PilotStatus BuildStatus()
    {
        var pairing = store.Current;
        return new PilotStatus
        {
            Enabled = pairing?.Enabled ?? false,
            Paired = pairing is not null,
            Conducting = driving && loop.Conducting,
            LastCycleAt = loop.LastCycleAt,
            LastCycleStatus = StatusName(loop.LastCycleStatus),
            ConsecutiveTimeouts = loop.ConsecutiveTimeouts,
            Connected = eventStreamConnected,
        };
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ResumeIfEnabledAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            // Publish the fresh CTS before reading the store: a WakeUp then either cancels the CTS this iteration
            // will actually use or happens-before the read, which then sees the new state — no lost wake window.
            CancellationTokenSource cts;
            lock (ctsGate)
            {
                iterationCts?.Dispose();
                iterationCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                cts = iterationCts;
            }

            var pairing = store.Current;
            if (pairing is null || !pairing.Enabled)
            {
                driving = false;
                if (!await AwaitUnlessCanceledAsync(wake.WaitAsync(stoppingToken)))
                {
                    return;
                }
                continue;
            }

            try
            {
                driving = true;
                await loop.RunIterationAsync(pairing, cts.Token);
            }
            catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
            {
                // Pairing changed mid-iteration; the loop re-reads state next pass. The session is left intact.
            }
            catch (OperationCanceledException)
            {
                return; // host shutting down
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Pilot iteration failed; backing off before retrying.");
                driving = false;
                if (!await AwaitUnlessCanceledAsync(Task.Delay(ErrorBackoff, stoppingToken)))
                {
                    return;
                }
            }
        }
    }

    /// <summary>On a fresh start already paired+enabled, resumes conducting after a short bind grace and journals it.</summary>
    private async Task ResumeIfEnabledAsync(CancellationToken stoppingToken)
    {
        var pairing = store.Current;
        if (pairing is null || !pairing.Enabled)
        {
            return;
        }

        if (!await AwaitUnlessCanceledAsync(env.SleepAsync(StartupResumeDelay, stoppingToken)))
        {
            return; // host shutting down before the grace elapsed
        }

        try
        {
            await env.ReportSystemAsync(ResumeReport);
        }
        catch
        {
            // Best-effort; a failed resume report must not fault the background service.
        }
    }

    /// <summary>Awaits a cancelable operation; returns false when it is canceled (host shutdown / wake).</summary>
    private static async Task<bool> AwaitUnlessCanceledAsync(Task operation)
    {
        try
        {
            await operation;
            return true;
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }

    private static string? StatusName(PilotCycleStatus? status) => status switch
    {
        PilotCycleStatus.Ok => "ok",
        PilotCycleStatus.Empty => "empty",
        PilotCycleStatus.Error => "error",
        _ => null,
    };

    public override void Dispose()
    {
        wake.Dispose();
        lock (ctsGate)
        {
            iterationCts?.Dispose();
        }
        base.Dispose();
    }
}

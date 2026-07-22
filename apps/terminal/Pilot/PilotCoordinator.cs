using JobPilot.Terminal.Common;
using JobPilot.Terminal.Contracts;
using Microsoft.Extensions.Hosting;

namespace JobPilot.Terminal.Pilot;

/// <summary>
/// Background loop that keeps re-injecting the pilot skill while pilot mode is running and recovers a stuck
/// session - the Pilot's local orchestrator. Reacts to start/stop without a host restart via <see cref="WakeUp"/>,
/// and owns the inter-cycle sleep so a wake can end it early and start the next cycle promptly.
/// </summary>
public sealed class PilotCoordinator(PilotStore store, IPilotRuntime env, ILogger<PilotCoordinator> logger) : BackgroundService
{
    private static readonly TimeSpan ErrorBackoff = TimeSpan.FromSeconds(30);

    // A restarted host waits this long before its first resumed cycle so Kestrel finishes binding first.
    private static readonly TimeSpan StartupResumeDelay = TimeSpan.FromSeconds(10);

    // Injecting with no reachable API is pure burn; back off instead, mirroring the SSE reconnect shape.
    internal static readonly TimeSpan ProbeBackoffInitial = TimeSpan.FromSeconds(30);
    internal static readonly TimeSpan ProbeBackoffMax = TimeSpan.FromMinutes(10);

    /// <summary>Journal summary pushed when a restarted host resumes conducting on its own.</summary>
    public const string ResumeReport = "Pilot resumed after the app restarted.";

    /// <summary>Journal summary pushed when the server-side run-state probe reports the pilot stopped.</summary>
    public const string StandingDownReport = "Pilot is stopped on the server - standing down.";

    private readonly PilotCycleRunner loop = new(env);
    private readonly PilotWakeSignal wake = new();
    private ExponentialBackoff probeBackoff = new(ProbeBackoffInitial, ProbeBackoffMax);
    private volatile bool driving;

    internal int WakeCount => wake.Count;

    internal int PendingWakeCount => wake.Pending;

    /// <summary>Signals the loop to re-read the pairing (after start/stop) and ends any inter-cycle sleep early.</summary>
    public void WakeUp() => wake.Pulse(() => store.Current is not { Running: true });

    /// <summary>Snapshot of pilot state for /healthz.</summary>
    public PilotStatus BuildStatus()
    {
        var pairing = store.Current;
        return new PilotStatus
        {
            Running = pairing?.Running ?? false,
            Paired = pairing is not null,
            Conducting = driving && loop.Conducting,
            LastCycleAt = loop.LastCycleAt,
            LastCycleStatus = StatusName(loop.LastCycleStatus),
            ConsecutiveTimeouts = loop.ConsecutiveTimeouts,
        };
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ResumeIfRunningAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            var cts = wake.BeginIteration(stoppingToken);
            driving = false;

            var pairing = store.Current;
            if (pairing is not { Running: true })
            {
                if (!await AwaitUnlessCanceledAsync(wake.WaitAsync(stoppingToken)))
                {
                    return;
                }
                continue;
            }

            try
            {
                // Gate on the authoritative server run-state so a stopped pilot burns zero cycles.
                var runState = await ProbeRunStateAsync(cts.Token);
                if (runState == false)
                {
                    // A stop-wake cancels cts, so the stand-down reports on stoppingToken instead.
                    await StandDownAsync(stoppingToken);
                    continue;
                }

                if (runState is null)
                {
                    // API unreachable: injecting would just burn a cycle - back off; a wake re-probes early.
                    await SleepRacingWakeAsync(probeBackoff.Next(), cts.Token);
                    continue;
                }

                probeBackoff.Reset();
                // Reading the current running pairing satisfies any pulse that arrived before this iteration.
                wake.TryConsume();

                driving = true;
                var sleep = await loop.RunIterationAsync(pairing, cts.Token);
                if (sleep is { } duration && duration > TimeSpan.Zero)
                {
                    // A wake (question answered, approved promotion, etc.) ends this sleep early; a stop cancels it.
                    await SleepRacingWakeAsync(duration, cts.Token);
                }
            }
            catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
            {
                // A stop aborts the in-flight turn; Conducting keeps Esc out of a user-driven mismatch session.
                if (loop.Conducting && store.Current is not { Running: true })
                {
                    env.InterruptSession();
                }
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

    /// <summary>
    /// On a fresh start already paired+enabled, resumes conducting after a short bind grace and journals it. If a
    /// planned inter-cycle break was still owed when the host restarted, waits out the remainder before the first inject.
    /// </summary>
    private async Task ResumeIfRunningAsync(CancellationToken stoppingToken)
    {
        if (store.Current is not { Running: true })
        {
            return;
        }

        if (!await AwaitUnlessCanceledAsync(env.SleepAsync(StartupResumeDelay, stoppingToken)))
        {
            return; // host shutting down before the grace elapsed
        }

        TimeSpan remaining;
        try
        {
            remaining = await loop.PrimeResumeAsync(stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        if (remaining <= TimeSpan.Zero)
        {
            await ReportAsync(ResumeReport, stoppingToken);
            return;
        }

        var until = DateTimeOffset.UtcNow + remaining;
        await ReportAsync($"{ResumeReport} Waiting out the planned break until {until:u} first.", stoppingToken);
        await SleepRacingWakeAsync(remaining, stoppingToken);
    }

    /// <summary>Mirrors a server-side stop into the local store so the next iteration parks, and journals it.</summary>
    private async Task StandDownAsync(CancellationToken stoppingToken)
    {
        store.SetRunning(false);
        probeBackoff.Reset();
        await ReportAsync(StandingDownReport, stoppingToken);
    }

    /// <summary>Sleeps between cycles; a wake ends it early, a stop cancels it through <paramref name="ct"/>.</summary>
    private async Task SleepRacingWakeAsync(TimeSpan duration, CancellationToken ct)
    {
        // A wake during the cycle found no sleep to cancel, so the queued pulse is its only trace.
        if (wake.TryConsume())
        {
            return;
        }

        using var sleep = wake.BeginSleep(ct);
        try
        {
            await env.SleepAsync(duration, sleep.Token);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            // A wake ended the inter-cycle sleep early; the loop starts the next cycle now.
        }
    }

    /// <summary>Run-state probe; any non-cancellation failure becomes null so the caller backs off.</summary>
    private async Task<bool?> ProbeRunStateAsync(CancellationToken ct)
    {
        try
        {
            return await env.GetRunStateAsync(ct);
        }
        catch (Exception ex) when (!Cancellation.IsCallerCancellation(ex, ct))
        {
            return null;
        }
    }

    /// <summary>Journals a coordinator intervention; a failed report must never fault the background service.</summary>
    private async Task ReportAsync(string summary, CancellationToken ct)
    {
        try
        {
            await env.ReportSystemAsync(summary, ct);
        }
        catch
        {
            // Best-effort by contract, so a throwing runtime still can't take the loop down.
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
        base.Dispose();
    }
}

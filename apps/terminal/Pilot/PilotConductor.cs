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

    private readonly PilotLoop loop = new PilotLoop(env);

    // Released to start from idle or to interrupt a running iteration when the pairing changes.
    private readonly SemaphoreSlim wake = new(0);
    private readonly Lock ctsGate = new();
    private CancellationTokenSource? iterationCts;
    private volatile bool driving;

    /// <summary>Signals the loop to re-read the pairing (after enable/disable).</summary>
    public void WakeUp()
    {
        wake.Release();
        lock (ctsGate)
        {
            iterationCts?.Cancel();
        }
    }

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
        };
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
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

            CancellationTokenSource cts;
            lock (ctsGate)
            {
                iterationCts?.Dispose();
                iterationCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                cts = iterationCts;
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

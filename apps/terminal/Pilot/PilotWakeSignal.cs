using System.Threading.Channels;

namespace JobPilot.Terminal.Pilot;

/// <summary>
/// The coordinator's wake plumbing: a coalescing pulse channel plus the cancellation sources a pulse may cancel.
/// Split out from the loop policy so the ordering that keeps wakes lossless lives in one place.
/// </summary>
internal sealed class PilotWakeSignal : IDisposable
{
    // A pulse wakes the idle loop. Capacity one coalesces bursts without stale permits.
    private readonly Channel<bool> pulses = Channel.CreateBounded<bool>(new BoundedChannelOptions(1)
    {
        SingleReader = true,
        SingleWriter = false,
        FullMode = BoundedChannelFullMode.DropWrite,
    });

    private readonly Lock gate = new();
    private CancellationTokenSource? iterationCts;
    private CancellationTokenSource? sleepCts;
    private int pulseCount;

    /// <summary>Total pulses received; a test seam to observe event-driven wakes.</summary>
    internal int Count => Volatile.Read(ref pulseCount);

    /// <summary>Pulses still queued - at most one, by the channel's capacity.</summary>
    internal int Pending => pulses.Reader.Count;

    /// <summary>
    /// Records a wake and ends any inter-cycle sleep early. <paramref name="abortCycle"/> is evaluated under the
    /// gate and, when true, also cancels the live cycle: a stop must abort the in-flight turn, while a wake that
    /// leaves the pilot running must never interrupt one.
    /// </summary>
    public void Pulse(Func<bool> abortCycle)
    {
        Interlocked.Increment(ref pulseCount);
        pulses.Writer.TryWrite(true);
        lock (gate)
        {
            sleepCts?.Cancel();
            if (abortCycle())
            {
                iterationCts?.Cancel();
            }
        }
    }

    /// <summary>
    /// Publishes the cancellation source for the iteration about to start. The caller must read its own state only
    /// after this returns: a pulse then either cancels the source that iteration will use or happens-before the
    /// read, which then sees the new state - no lost wake window.
    /// </summary>
    public CancellationTokenSource BeginIteration(CancellationToken stoppingToken)
    {
        lock (gate)
        {
            iterationCts?.Dispose();
            iterationCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            return iterationCts;
        }
    }

    /// <summary>Consumes one queued pulse; true when a wake was already waiting.</summary>
    public bool TryConsume() => pulses.Reader.TryRead(out _);

    /// <summary>Waits for the next pulse - the parked loop's only wake source.</summary>
    public Task WaitAsync(CancellationToken ct) => pulses.Reader.ReadAsync(ct).AsTask();

    /// <summary>Opens a sleep whose token a pulse cancels, so an inter-cycle sleep can end early.</summary>
    public SleepScope BeginSleep(CancellationToken ct) => new(this, ct);

    public void Dispose()
    {
        lock (gate)
        {
            iterationCts?.Dispose();
        }
    }

    /// <summary>A cancelable inter-cycle sleep; disposing unregisters it so a later pulse has nothing stale to cancel.</summary>
    internal readonly struct SleepScope : IDisposable
    {
        private readonly PilotWakeSignal signal;
        private readonly CancellationTokenSource cts;

        internal SleepScope(PilotWakeSignal signal, CancellationToken ct)
        {
            this.signal = signal;
            cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            lock (signal.gate)
            {
                signal.sleepCts = cts;
            }
        }

        public CancellationToken Token => cts.Token;

        public void Dispose()
        {
            lock (signal.gate)
            {
                signal.sleepCts = null;
            }
            cts.Dispose();
        }
    }
}

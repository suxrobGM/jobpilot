using System.Threading.Channels;

namespace JobPilot.Terminal.Pilot;

/// <summary>Ends the loop's inter-cycle sleep early. Capacity one coalesces a burst of wakes into one.</summary>
public sealed class PilotWakes
{
    private readonly Channel<bool> channel = Channel.CreateBounded<bool>(
        new BoundedChannelOptions(1) { FullMode = BoundedChannelFullMode.DropWrite, SingleReader = true });

    public void Signal() => channel.Writer.TryWrite(true);

    /// <summary>Takes the pending wake, if there is one.</summary>
    public bool TryTake() => channel.Reader.TryRead(out _);

    public async Task TakeAsync(CancellationToken ct) => await channel.Reader.ReadAsync(ct);

    /// <summary>Completes when a wake is pending, without taking it.</summary>
    public Task WaitAsync(CancellationToken ct) => channel.Reader.WaitToReadAsync(ct).AsTask();
}

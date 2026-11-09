namespace JobPilot.Terminal.Sessions.Relay;

/// <summary>Byte-bounded FIFO of recent output, replayed to a new client so a reload restores the screen.</summary>
internal sealed class ReplayBuffer(int capacityBytes)
{
    private readonly Queue<byte[]> chunks = new();
    private int bytes;

    public IReadOnlyCollection<byte[]> Chunks => chunks;

    public void Append(byte[] data)
    {
        while (bytes + data.Length > capacityBytes && chunks.Count > 0)
        {
            bytes -= chunks.Dequeue().Length;
        }

        chunks.Enqueue(data);
        bytes += data.Length;
    }

    public void Clear()
    {
        chunks.Clear();
        bytes = 0;
    }
}

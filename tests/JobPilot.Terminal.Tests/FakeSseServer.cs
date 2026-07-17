using System.Net;
using System.Text;
using System.Threading.Channels;

namespace JobPilot.Terminal.Tests;

/// <summary>An HttpMessageHandler that serves one controllable SSE stream and records the request.</summary>
internal sealed class FakeSseHandler : HttpMessageHandler
{
    public FakeSseStream Stream { get; } = new();
    public HttpStatusCode Status { get; init; } = HttpStatusCode.OK;
    public int Calls { get; private set; }
    public HttpRequestMessage? LastRequest { get; private set; }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Calls++;
        LastRequest = request;
        var response = new HttpResponseMessage(Status);
        if (Status == HttpStatusCode.OK)
        {
            response.Content = new StreamContent(Stream);
            response.Content.Headers.ContentType = new("text/event-stream");
        }
        else
        {
            response.Content = new StringContent(string.Empty);
        }
        return Task.FromResult(response);
    }
}

/// <summary>A read-only stream fed on demand, so a test can push SSE frames and hold the connection open.</summary>
internal sealed class FakeSseStream : Stream
{
    private readonly Channel<byte[]> chunks = Channel.CreateUnbounded<byte[]>();
    private byte[]? current;
    private int offset;

    public void Push(string text) => chunks.Writer.TryWrite(Encoding.UTF8.GetBytes(text));

    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
    {
        while (current is null || offset >= current.Length)
        {
            if (!await chunks.Reader.WaitToReadAsync(cancellationToken))
            {
                return 0;
            }
            chunks.Reader.TryRead(out current);
            offset = 0;
        }

        var count = Math.Min(buffer.Length, current!.Length - offset);
        current.AsMemory(offset, count).CopyTo(buffer);
        offset += count;
        return count;
    }

    public override int Read(byte[] buffer, int offset, int count) =>
        ReadAsync(buffer.AsMemory(offset, count)).AsTask().GetAwaiter().GetResult();

    public override bool CanRead => true;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => throw new NotSupportedException();
    public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
    public override void Flush() { }
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
}

using Pty.Net;

namespace JobPilot.Terminal.Tests;

/// <summary>
/// Controllable Pty.Net connection double. Mirrors the Unix implementation's failure modes: Kill and
/// Dispose throw for an already-exited child, and reads fail with EIO instead of returning EOF.
/// </summary>
internal sealed class FakePtyConnection : IPtyConnection
{
#pragma warning disable CS0067 // Only real Pty.Net connections raise this; PtyProcess's EOF fallback covers the fakes.
    public event EventHandler<PtyExitedEventArgs>? ProcessExited;
#pragma warning restore CS0067

    public ScriptedReadStream Reader { get; } = new();

    public Stream Writer { get; set; } = Stream.Null;

    public bool KillThrows { get; set; }

    public bool ResizeThrows { get; set; }

    public bool DisposeThrows { get; set; }

    public int KillCalls { get; private set; }

    public int DisposeCalls { get; private set; }

    public int ResizeCalls { get; private set; }

    public Stream ReaderStream => Reader;

    public Stream WriterStream => Writer;

    public int Pid => 1;

    public int ExitCode { get; set; }

    public bool WaitForExit(int milliseconds) => true;

    public void Kill()
    {
        KillCalls++;
        if (KillThrows)
        {
            throw new InvalidOperationException("Killing terminal failed with error 3");
        }
    }

    public void Dispose()
    {
        DisposeCalls++;
        if (DisposeThrows)
        {
            throw new InvalidOperationException("Killing terminal failed with error 3");
        }
    }

    public void Resize(int cols, int rows)
    {
        ResizeCalls++;
        if (ResizeThrows)
        {
            throw new InvalidOperationException("Resizing terminal failed with error 5");
        }
    }
}

/// <summary>Blocks readers until the test scripts a failure, like a pty master with a live child.</summary>
internal sealed class ScriptedReadStream : Stream
{
    private readonly SemaphoreSlim pending = new(0);
    private Exception? failure;

    public void FailNextRead(Exception ex)
    {
        failure = ex;
        pending.Release();
    }

    public override int Read(byte[] buffer, int offset, int count)
    {
        pending.Wait();
        throw failure ?? new EndOfStreamException();
    }

    public override bool CanRead => true;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => 0;

    public override long Position
    {
        get => 0;
        set { }
    }

    public override void Flush()
    {
    }

    public override long Seek(long offset, SeekOrigin origin) => 0;

    public override void SetLength(long value)
    {
    }

    public override void Write(byte[] buffer, int offset, int count)
    {
    }
}

/// <summary>Fails every write with EIO, like a pty master whose child has exited.</summary>
internal sealed class DeadWriteStream : Stream
{
    public override void Write(byte[] buffer, int offset, int count) =>
        throw new IOException("Input/output error");

    public override void Flush()
    {
    }

    public override int Read(byte[] buffer, int offset, int count) => 0;

    public override bool CanRead => false;
    public override bool CanSeek => false;
    public override bool CanWrite => true;
    public override long Length => 0;

    public override long Position
    {
        get => 0;
        set { }
    }

    public override long Seek(long offset, SeekOrigin origin) => 0;

    public override void SetLength(long value)
    {
    }
}

using JobPilot.Terminal.Sessions.Pty;
using JobPilot.Terminal.Tests.Support;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using static JobPilot.Terminal.Tests.Support.Builders;

namespace JobPilot.Terminal.Tests.Sessions.Pty;

/// <summary>On Unix, Pty.Net's Kill/Dispose throw for an exited child and reads fail with EIO; neither may crash the host.</summary>
public sealed class PtyProcessTests
{
    [Fact]
    public void Dispose_ToleratesKillAndDisposeOfADeadProcess()
    {
        var connection = new FakePtyConnection { KillThrows = true, DisposeThrows = true };
        var pty = StartedPty(connection);

        pty.Dispose();

        Assert.Equal(1, connection.DisposeCalls);
    }

    [Fact]
    public async Task ReadFailure_RaisesExitOnce_WithTheRealCode()
    {
        var connection = new FakePtyConnection { ExitCode = 42 };
        using var pty = StartedPty(connection);
        var exits = new List<int>();
        pty.Exited += exits.Add;

        connection.Reader.FailNextRead(new IOException("Input/output error"));
        await TestWait.Until(() => exits.Count > 0);
        connection.RaiseExit(42);

        Assert.Equal([42], exits);
    }

    [Fact]
    public async Task NoExitIsRaised_AfterDispose()
    {
        var connection = new FakePtyConnection();
        var pty = StartedPty(connection);
        var exits = 0;
        pty.Exited += _ => Interlocked.Increment(ref exits);

        pty.Dispose();
        connection.RaiseExit();
        connection.Reader.FailNextRead(new IOException("Input/output error"));

        // Longer than the EOF grace, so a wrongly raised fallback exit would have landed by now.
        await Task.Delay(700, TestContext.Current.CancellationToken);
        Assert.Equal(0, exits);
    }

    [Fact]
    public void Start_ShowsTheFailure_AndThrows_WhenTheProcessCannotSpawn()
    {
        var options = PtyProcess.BuildOptions("claude", [], ".", 80, 24, binDir: null, new Dictionary<string, string>());
        var pty = new PtyProcess(options, _ => throw new FileNotFoundException("not on PATH"), NullLogger.Instance);
        var output = new List<byte[]>();
        pty.Output += output.Add;

        Assert.Throws<PtyStartException>(pty.Start);
        Assert.Contains("not on PATH", System.Text.Encoding.UTF8.GetString(Assert.Single(output)));
    }

    [Fact]
    public void WriteAndResize_TolerateADeadPty()
    {
        var connection = new FakePtyConnection { Writer = new DeadWriteStream(), ResizeThrows = true };
        using var pty = StartedPty(connection);

        pty.Write("hello"u8.ToArray());
        pty.Resize(120, 40);
    }
}

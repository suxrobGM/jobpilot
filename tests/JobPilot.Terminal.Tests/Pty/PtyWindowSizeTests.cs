using System.Runtime.InteropServices;
using JobPilot.Terminal.Pty;
using Microsoft.Win32.SafeHandles;
using Pty.Net;
using Xunit;

namespace JobPilot.Terminal.Tests;

/// <summary>
/// Regression tests for the garbled agent panel: Pty.Net's Resize left the child with a ~28000-column
/// winsize on Apple silicon, so Claude Code's TUI wrapped and repainted against a size no one could see.
/// These drive a real pty master rather than a child process - forking under the parallel suite hangs
/// before exec, so the end-to-end check against a live session is a manual one.
/// </summary>
public sealed class PtyWindowSizeTests
{
    private const int Cols = 100;
    private const int Rows = 30;

    /// <summary>_IOR('t', 104, struct winsize) on Darwin.</summary>
    private const ulong TIOCGWINSZ = 0x40087468;

    /// <summary>The fake's streams aren't pty fds, so every platform takes the fallback here.</summary>
    [Fact]
    public void FallsBackToPtyNet_WhenTheStreamIsNotAPtyFileDescriptor()
    {
        var connection = new FakePtyConnection();
        using var pty = new PtyProcess(_ => connection);
        pty.Start("claude", [], ".", 80, 24);

        pty.Resize(Cols, Rows);

        Assert.Equal(1, connection.ResizeCalls);
    }

    [Fact]
    public void SetsTheWinsizeTheKernelActuallyStores()
    {
        // The manual TIOCSWINSZ path only replaces Pty.Net's resize on Apple silicon.
        if (!OperatingSystem.IsMacOS() || RuntimeInformation.ProcessArchitecture != Architecture.Arm64)
        {
            return;
        }

        Assert.Equal(0, OpenPty(out var master, out var replica, 0, 0, 0));
        using var replicaHandle = new SafeFileHandle(replica, ownsHandle: true);
        using var handle = new SafeFileHandle(master, ownsHandle: true);
        using var stream = new FileStream(handle, FileAccess.ReadWrite);

        Assert.True(PtyWindowSize.TrySet(new PtyMaster(stream), Cols, Rows));

        var size = default(WinSize);
        Assert.Equal(0, Ioctl(master, TIOCGWINSZ, 0, 0, 0, 0, 0, 0, ref size));
        Assert.Equal(Rows, size.Rows);
        Assert.Equal(Cols, size.Cols);
    }

    [DllImport("libc", EntryPoint = "openpty", SetLastError = true)]
    private static extern int OpenPty(out int master, out int replica, nint name, nint termios, nint winsize);

    /// <summary>Padded like the code under test; Apple's arm64 ABI passes varargs on the stack.</summary>
    [DllImport("libc", EntryPoint = "ioctl", SetLastError = true)]
    private static extern int Ioctl(
        int fd, ulong request, nint p2, nint p3, nint p4, nint p5, nint p6, nint p7, ref WinSize size);

    [StructLayout(LayoutKind.Sequential)]
    private struct WinSize
    {
        public ushort Rows;
        public ushort Cols;
        public ushort PixelWidth;
        public ushort PixelHeight;
    }

    /// <summary>Presents a pty master fd the way Pty.Net's Unix connection does.</summary>
    private sealed class PtyMaster(Stream stream) : IPtyConnection
    {
#pragma warning disable CS0067 // Nothing in this test waits on a child.
        public event EventHandler<PtyExitedEventArgs>? ProcessExited;
#pragma warning restore CS0067

        public Stream ReaderStream => stream;

        public Stream WriterStream => stream;

        public int Pid => 0;

        public int ExitCode => 0;

        public bool WaitForExit(int milliseconds) => true;

        public void Kill()
        {
        }

        public void Resize(int cols, int rows) => throw new InvalidOperationException(
            "The manual TIOCSWINSZ path must not fall back to Pty.Net for a real pty master.");

        public void Dispose()
        {
        }
    }
}

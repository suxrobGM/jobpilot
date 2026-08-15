using System.Runtime.InteropServices;
using Pty.Net;

namespace JobPilot.Terminal.Pty;

/// <summary>
/// Sets the pty winsize directly on Apple silicon, where Pty.Net's own <c>Resize</c> corrupts it.
/// </summary>
/// <remarks>
/// libc's <c>ioctl</c> is variadic. Apple's arm64 ABI passes variadic arguments on the stack while the
/// first eight fixed arguments use x0-x7, so Pty.Net's three-argument P/Invoke leaves the winsize pointer
/// in a register and the kernel reads whatever the stack held - the child gets a random size (~28000 cols)
/// and every TUI repaint wraps against it. Padding to nine arguments puts the pointer back on the stack.
/// Every other target passes varargs in registers, where that padding would itself be wrong, so they keep
/// Pty.Net's implementation.
/// </remarks>
internal static class PtyWindowSize
{
    private static readonly bool NeedsManualResize =
        OperatingSystem.IsMacOS() && RuntimeInformation.ProcessArchitecture == Architecture.Arm64;

    /// <summary>_IOW('t', 103, struct winsize) on Darwin.</summary>
    private const ulong TIOCSWINSZ = 0x80087467;

    /// <summary>Applies the size, or returns false to fall back to Pty.Net's resize.</summary>
    internal static bool TrySet(IPtyConnection connection, int cols, int rows)
    {
        // A size outside ushort would silently wrap into a plausible-looking winsize.
        if (!NeedsManualResize || cols is <= 0 or > ushort.MaxValue || rows is <= 0 or > ushort.MaxValue)
        {
            return false;
        }

        // Pty.Net's Unix streams wrap the pty controller itself, so this handle is the fd to resize.
        if (connection.ReaderStream is not FileStream { SafeFileHandle: { IsInvalid: false, IsClosed: false } handle })
        {
            return false;
        }

        var size = new WinSize { Rows = (ushort)rows, Cols = (ushort)cols };
        var referenced = false;
        try
        {
            handle.DangerousAddRef(ref referenced);
            return Ioctl((int)handle.DangerousGetHandle(), TIOCSWINSZ, 0, 0, 0, 0, 0, 0, ref size) == 0;
        }
        finally
        {
            if (referenced)
            {
                handle.DangerousRelease();
            }
        }
    }

    [DllImport("libc", EntryPoint = "ioctl", SetLastError = true)]
    private static extern int Ioctl(
        int fd,
        ulong request,
        nint pad2,
        nint pad3,
        nint pad4,
        nint pad5,
        nint pad6,
        nint pad7,
        ref WinSize size);

    [StructLayout(LayoutKind.Sequential)]
    private struct WinSize
    {
        public ushort Rows;
        public ushort Cols;
        public ushort PixelWidth;
        public ushort PixelHeight;
    }
}

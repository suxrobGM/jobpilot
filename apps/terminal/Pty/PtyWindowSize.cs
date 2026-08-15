using System.ComponentModel;
using System.Runtime.InteropServices;
using Pty.Net;

namespace JobPilot.Terminal.Pty;

/// <summary>Sets the pty winsize on Apple silicon, where Pty.Net's own <c>Resize</c> corrupts it.</summary>
/// <remarks>
/// libc's ioctl is variadic and Apple's arm64 ABI passes varargs on the stack, so Pty.Net's three-argument
/// P/Invoke leaves the winsize pointer in a register and the kernel copies stack garbage instead: the child
/// ends up around 28000 columns wide. Padding the call to nine arguments puts the pointer back on the stack.
/// Every other target passes varargs in registers and keeps Pty.Net's version.
/// </remarks>
internal static class PtyWindowSize
{
    /// <summary>True where Pty.Net's <c>Resize</c> corrupts the winsize and this class must do it instead.</summary>
    internal static bool IsRequired { get; } =
        OperatingSystem.IsMacOS() && RuntimeInformation.ProcessArchitecture == Architecture.Arm64;

    /// <summary>_IOW('t', 103, struct winsize) on Darwin.</summary>
    private const ulong TIOCSWINSZ = 0x80087467;

    /// <summary>Sets the winsize, or throws. The caller's only fallback is the resize this replaces.</summary>
    internal static void Set(IPtyConnection connection, int cols, int rows)
    {
        // A size outside ushort would wrap into a winsize that still looks plausible.
        if (cols is <= 0 or > ushort.MaxValue || rows is <= 0 or > ushort.MaxValue)
        {
            throw new ArgumentOutOfRangeException(nameof(cols), $"{cols}x{rows} does not fit a winsize.");
        }

        // Pty.Net's Unix streams wrap the pty controller itself, so this handle is the fd to resize.
        if (connection.ReaderStream is not FileStream { SafeFileHandle: { IsInvalid: false, IsClosed: false } handle })
        {
            throw new InvalidOperationException("The connection does not expose a live pty controller fd.");
        }

        var size = new WinSize { Rows = (ushort)rows, Cols = (ushort)cols };
        var referenced = false;
        try
        {
            handle.DangerousAddRef(ref referenced);
            if (Ioctl((int)handle.DangerousGetHandle(), TIOCSWINSZ, 0, 0, 0, 0, 0, 0, ref size) != 0)
            {
                throw new Win32Exception(Marshal.GetLastPInvokeError());
            }
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

using System.Runtime.InteropServices;

namespace JobPilot.Terminal.Hosting;

/// <summary>
/// P/Invoke shims for the few Win32 calls the host needs.
/// </summary>
internal static partial class NativeMethods
{
    /// <summary>
    /// Detaches the process from its console window - used to drop the window the shell flashes open when
    /// the host is launched via the <c>jobpilot://</c> URL scheme.
    /// </summary>
    [LibraryImport("kernel32")]
    internal static partial void FreeConsole();
}

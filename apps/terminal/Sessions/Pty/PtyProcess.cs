using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using Pty.Net;

namespace JobPilot.Terminal.Sessions.Pty;

public sealed class PtyStartException(string command, Exception innerException)
    : Exception($"Failed to start '{command}': {innerException.Message}", innerException);

/// <summary>
/// One Pty.Net process (ConPTY or forkpty). Subscribe to its events, then call <see cref="Start"/>.
/// <see cref="Exited"/> fires at most once, and only when the process dies on its own, never after Dispose.
/// </summary>
public sealed class PtyProcess : IDisposable
{
    static PtyProcess()
    {
        // Pty.Net's assembly imports a bundled conpty.dll it does not ship.
        if (OperatingSystem.IsWindows())
        {
            NativeLibrary.SetDllImportResolver(typeof(PtyProvider).Assembly, ResolveConPty);
        }
    }

    // Give Pty.Net's exit event a chance to deliver the real code before the EOF fallback reports one.
    private static readonly TimeSpan EofExitGrace = TimeSpan.FromMilliseconds(500);

    private readonly PtyOptions options;
    private readonly Func<PtyOptions, IPtyConnection> spawn;
    private readonly ILogger logger;

    private IPtyConnection? connection;
    private volatile bool disposed;
    private int exitRaised;

    public PtyProcess(PtyOptions options, Func<PtyOptions, IPtyConnection> spawn, ILogger logger)
    {
        this.options = options;
        this.spawn = spawn;
        this.logger = logger;
    }

    public event Action<byte[]>? Output;

    public event Action<int>? Exited;

    /// <exception cref="PtyStartException">The process could not be spawned.</exception>
    public void Start()
    {
        try
        {
            connection = spawn(options);
        }
        catch (Exception ex)
        {
            Output?.Invoke(Encoding.UTF8.GetBytes($"\e[31mFailed to start '{options.App}': {ex.Message}\e[0m\r\n"));
            throw new PtyStartException(options.App, ex);
        }

        connection.ProcessExited += (_, e) => RaiseExit(e.ExitCode);
        new Thread(() => ReadLoop(connection)) { IsBackground = true, Name = "PTY-Read" }.Start();
    }

    public void Write(byte[] data)
    {
        if (disposed || connection is not { } active)
        {
            return;
        }

        try
        {
            active.WriterStream.Write(data, 0, data.Length);
            active.WriterStream.Flush();
        }
        catch
        {
            // The pty died (Unix reports EIO) or was disposed mid-write; the exit path owns the state.
        }
    }

    public void Resize(int cols, int rows)
    {
        if (disposed || connection is not { } active)
        {
            return;
        }

        try
        {
            if (PtyWindowSize.IsRequired)
            {
                PtyWindowSize.Set(active, cols, rows);
            }
            else
            {
                active.Resize(cols, rows);
            }
        }
        catch (Exception ex)
        {
            // Usually a child that just exited. Logged because a failing TIOCSWINSZ garbles the panel silently.
            logger.LogWarning(ex, "Resize to {Cols}x{Rows} failed.", cols, rows);
        }
    }

    public void Dispose()
    {
        if (disposed)
        {
            return;
        }

        disposed = true;
        if (connection is not { } active)
        {
            return;
        }

        // On Unix, Kill and Dispose throw ESRCH for a child that already exited. That is still a stop.
        BestEffort(active.Kill);
        BestEffort(active.Dispose);
    }

    public static IPtyConnection SpawnWithPtyNet(PtyOptions options) =>
        Task.Run(() => PtyProvider.SpawnAsync(options, CancellationToken.None)).GetAwaiter().GetResult();

    private void ReadLoop(IPtyConnection active)
    {
        var buffer = new byte[4096];
        try
        {
            while (!disposed)
            {
                var bytesRead = active.ReaderStream.Read(buffer, 0, buffer.Length);
                if (bytesRead <= 0 || disposed)
                {
                    break;
                }

                Output?.Invoke(buffer.AsSpan(0, bytesRead).ToArray());
            }
        }
        catch
        {
            // Unix pty reads fail with EIO instead of EOF once the child exits; escaping would kill the host.
        }

        if (disposed)
        {
            return;
        }

        // Pty.Net's exit event is missed when the child dies before Start subscribes; RaiseExit dedupes.
        Thread.Sleep(EofExitGrace);
        RaiseExit(ExitCodeOf(active));
    }

    private void RaiseExit(int exitCode)
    {
        if (disposed || Interlocked.Exchange(ref exitRaised, 1) == 1)
        {
            return;
        }

        Exited?.Invoke(exitCode);
    }

    private static int ExitCodeOf(IPtyConnection connection)
    {
        try
        {
            return connection.ExitCode;
        }
        catch
        {
            return -1;
        }
    }

    private static void BestEffort(Action action)
    {
        try
        {
            action();
        }
        catch
        {
        }
    }

    private static IntPtr ResolveConPty(string libraryName, Assembly assembly, DllImportSearchPath? searchPath) =>
        libraryName is "os64\\conpty.dll" or "os86\\conpty.dll"
            ? NativeLibrary.Load("kernel32.dll")
            : IntPtr.Zero;
}

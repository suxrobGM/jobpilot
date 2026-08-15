using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Pty.Net;

namespace JobPilot.Terminal.Pty;

/// <summary>Raised when a PTY process cannot start.</summary>
public sealed class PtyStartException(string command, Exception innerException)
    : Exception($"Failed to start '{command}': {innerException.Message}", innerException);

/// <summary>Pty.Net-backed process using ConPTY or forkpty.</summary>
public sealed class PtyProcess : IPty
{
    static PtyProcess()
    {
        // Pty.Net's assembly imports a bundled conpty.dll it does not ship.
        if (OperatingSystem.IsWindows())
        {
            NativeLibrary.SetDllImportResolver(typeof(PtyProvider).Assembly, ResolveConPty);
        }
    }

    private static IntPtr ResolveConPty(string libraryName, Assembly assembly, DllImportSearchPath? searchPath) =>
        libraryName is "os64\\conpty.dll" or "os86\\conpty.dll"
            ? NativeLibrary.Load("kernel32.dll")
            : IntPtr.Zero;

    // Give Pty.Net's exit event a chance to deliver the real code before the EOF fallback reports one.
    private static readonly TimeSpan EofExitGrace = TimeSpan.FromMilliseconds(500);

    private readonly Lock connectionLock = new();
    private readonly Func<PtyOptions, IPtyConnection> spawner;
    private readonly ILogger<PtyProcess> logger;

    private IPtyConnection? connection;
    private int generation;
    private int exitRaisedGeneration;

    public PtyProcess(ILogger<PtyProcess> logger)
        : this(SpawnWithPtyNet, logger)
    {
    }

    // Test seam: production spawning goes through Pty.Net's static provider.
    internal PtyProcess(Func<PtyOptions, IPtyConnection> spawner, ILogger<PtyProcess>? logger = null)
    {
        this.spawner = spawner;
        this.logger = logger ?? NullLogger<PtyProcess>.Instance;
    }

    /// <inheritdoc />
    public event Action<byte[]>? OutputReceived;

    /// <inheritdoc />
    public event Action<PtyExit>? ProcessExited;

    /// <inheritdoc />
    public int Start(
        string command,
        string[] args,
        string workingDirectory,
        int cols,
        int rows,
        IReadOnlyDictionary<string, string>? environment = null)
    {
        Stop();

        var gen = Interlocked.Increment(ref generation);

        IPtyConnection spawned;
        try
        {
            spawned = spawner(BuildOptions(command, args, workingDirectory, cols, rows, environment));
        }
        catch (Exception ex)
        {
            OutputReceived?.Invoke(Encoding.UTF8.GetBytes($"\e[31mFailed to start '{command}': {ex.Message}\e[0m\r\n"));
            throw new PtyStartException(command, ex);
        }

        // Do not suppress killed-process exits; their generation lets SessionManager discard stale ones.
        spawned.ProcessExited += (_, e) => NotifyExit(gen, e.ExitCode);

        lock (connectionLock)
        {
            connection = spawned;
        }

        new Thread(() => ReadLoop(spawned, gen)) { IsBackground = true, Name = "PTY-Read" }.Start();
        return gen;
    }

    /// <inheritdoc />
    public void Write(byte[] data)
    {
        var active = CurrentConnection();
        if (active is null)
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
            // The pty died (Unix reports EIO) or was replaced mid-write; the exit event owns the state.
        }
    }

    /// <inheritdoc />
    public void Resize(int cols, int rows)
    {
        var active = CurrentConnection();
        if (active is null)
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
            // Usually a pty whose child just exited. Logged because a failing TIOCSWINSZ garbles the
            // panel and leaves no other trace.
            logger.LogWarning(ex, "Resize to {Cols}x{Rows} failed.", cols, rows);
        }
    }

    /// <inheritdoc />
    public void Stop()
    {
        IPtyConnection? oldConnection;
        lock (connectionLock)
        {
            // Invalidate the read loop before closing its stream.
            Interlocked.Increment(ref generation);
            oldConnection = connection;
            connection = null;
        }

        if (oldConnection is null)
        {
            return;
        }

        // On Unix, Kill and Dispose throw ESRCH for a child that already exited. That is still a
        // successful stop, so both run regardless. Kill raises ProcessExited with its own generation.
        BestEffort(oldConnection.Kill);
        BestEffort(oldConnection.Dispose);
    }

    public void Dispose() => Stop();

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

    private IPtyConnection? CurrentConnection()
    {
        lock (connectionLock)
        {
            return connection;
        }
    }

    private void ReadLoop(IPtyConnection active, int gen)
    {
        var buffer = new byte[4096];
        try
        {
            while (Volatile.Read(ref generation) == gen)
            {
                var bytesRead = active.ReaderStream.Read(buffer, 0, buffer.Length);
                if (bytesRead <= 0)
                {
                    RaiseFallbackExit(active, gen);
                    break;
                }

                if (Volatile.Read(ref generation) != gen) break;

                OutputReceived?.Invoke(buffer.AsSpan(0, bytesRead).ToArray());
            }
        }
        catch when (Volatile.Read(ref generation) != gen)
        {
            // Stop closed this generation's stream.
        }
        catch
        {
            // Unix pty reads fail with EIO instead of EOF once the child exits; escaping would kill the host.
            RaiseFallbackExit(active, gen);
        }
    }

    // Pty.Net's exit event can be missed when the process dies before Start subscribes; NotifyExit dedupes.
    private void RaiseFallbackExit(IPtyConnection active, int gen)
    {
        Thread.Sleep(EofExitGrace);
        if (Volatile.Read(ref generation) == gen)
        {
            NotifyExit(gen, TryGetExitCode(active));
        }
    }

    /// <summary>Raises at most one exit per generation; the real event and the EOF fallback both call it.</summary>
    private void NotifyExit(int gen, int exitCode)
    {
        if (Interlocked.Exchange(ref exitRaisedGeneration, gen) == gen)
        {
            return;
        }
        ProcessExited?.Invoke(new PtyExit(gen, exitCode));
    }

    private static int TryGetExitCode(IPtyConnection connection)
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

    private static IPtyConnection SpawnWithPtyNet(PtyOptions options) =>
        Task.Run(() => PtyProvider.SpawnAsync(options, CancellationToken.None)).GetAwaiter().GetResult();

    private static PtyOptions BuildOptions(
        string command,
        string[] args,
        string workingDirectory,
        int cols,
        int rows,
        IReadOnlyDictionary<string, string>? environment)
    {
        // UTF-8 locale so spawned tools don't mangle non-ASCII; macOS ships en_US.UTF-8, not C.UTF-8.
        var utf8Locale = OperatingSystem.IsMacOS() ? "en_US.UTF-8" : "C.UTF-8";
        var env = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["TERM"] = "xterm-256color",
            ["LANG"] = utf8Locale,
            ["LC_ALL"] = utf8Locale,
            ["PYTHONUTF8"] = "1",
        };
        // Pty.Net merges this dict over the host's own env, so a stripped host PATH needs repair here.
        foreach (var kvp in PtyEnvironment.BuildOverrides())
        {
            env[kvp.Key] = kvp.Value;
        }
        if (environment is not null)
        {
            foreach (var kvp in environment)
            {
                env[kvp.Key] = kvp.Value;
            }
        }

        return new PtyOptions
        {
            App = command,
            CommandLine = args,
            Cwd = workingDirectory,
            Cols = cols,
            Rows = rows,
            ForceWinPty = false,
            Environment = env,
        };
    }
}

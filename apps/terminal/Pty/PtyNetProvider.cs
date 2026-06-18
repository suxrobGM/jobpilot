using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using Pty.Net;

namespace JobPilot.Terminal.Pty;

/// <summary>Pty.Net-backed provider on the OS in-box ConPTY (static ctor redirects conpty.dll to kernel32).</summary>
[SupportedOSPlatform("windows")]
public sealed class PtyNetProvider : IPtyProvider
{
    static PtyNetProvider()
    {
        // Quick.PtyNet loads a bundled os64\conpty.dll it never ships; use the OS in-box ConPTY in kernel32 instead.
        NativeLibrary.SetDllImportResolver(typeof(PtyProvider).Assembly, ResolveConPty);
    }

    private static IntPtr ResolveConPty(string libraryName, Assembly assembly, DllImportSearchPath? searchPath) =>
        libraryName is "os64\\conpty.dll" or "os86\\conpty.dll"
            ? NativeLibrary.Load("kernel32.dll")
            : IntPtr.Zero;

    private IPtyConnection? connection;
    private Thread? readThread;
    private volatile bool disposed;

    /// <inheritdoc />
    public event Action<byte[]>? OutputReceived;

    /// <inheritdoc />
    public event Action<int>? ProcessExited;

    /// <inheritdoc />
    public void Start(
        string command,
        string[] args,
        string workingDirectory,
        int cols,
        int rows,
        IReadOnlyDictionary<string, string>? environment = null)
    {
        var commandLine = new string[args.Length + 1];
        commandLine[0] = command;
        Array.Copy(args, 0, commandLine, 1, args.Length);

        var env = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["TERM"] = "xterm-256color",
            // UTF-8 locale so spawned tools don't mangle non-ASCII (em-dashes, smart quotes) via the system code page.
            ["LANG"] = "C.UTF-8",
            ["LC_ALL"] = "C.UTF-8",
            ["PYTHONUTF8"] = "1"
        };
        if (environment is not null)
        {
            foreach (var kvp in environment)
            {
                env[kvp.Key] = kvp.Value;
            }
        }

        var options = new PtyOptions
        {
            App = command,
            CommandLine = commandLine,
            Cwd = workingDirectory,
            Cols = cols,
            Rows = rows,
            ForceWinPty = false,
            Environment = env
        };

        connection = Task.Run(() => PtyProvider.SpawnAsync(options, CancellationToken.None))
            .GetAwaiter().GetResult();

        connection.ProcessExited += (_, e) => ProcessExited?.Invoke(e.ExitCode);

        readThread = new Thread(ReadLoop)
        {
            IsBackground = true,
            Name = "PTY-Read"
        };
        readThread.Start();
    }

    /// <inheritdoc />
    public void Write(byte[] data)
    {
        try
        {
            connection?.WriterStream.Write(data, 0, data.Length);
            connection?.WriterStream.Flush();
        }
        catch when (disposed)
        {
        }
    }

    /// <inheritdoc />
    public void Resize(int cols, int rows)
    {
        connection?.Resize(cols, rows);
    }

    private void ReadLoop()
    {
        var buffer = new byte[4096];
        try
        {
            while (!disposed && connection is not null)
            {
                var bytesRead = connection.ReaderStream.Read(buffer, 0, buffer.Length);
                if (bytesRead <= 0) break;

                var data = new byte[bytesRead];
                Array.Copy(buffer, data, bytesRead);
                OutputReceived?.Invoke(data);
            }
        }
        catch when (disposed)
        {
        }
    }

    /// <inheritdoc />
    public void Dispose()
    {
        if (disposed) return;
        disposed = true;

        connection?.Kill();
        connection?.Dispose();
    }
}

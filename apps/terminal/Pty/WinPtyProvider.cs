using System.Runtime.Versioning;
using Pty.Net;

namespace JobPilot.Terminal.Pty;

/// <summary>
/// PTY provider that uses winpty (via Quick.PtyNet) instead of ConPTY.
/// Winpty uses screen-scraping of a hidden console, which works on all
/// Windows versions including those with broken ConPTY rendering (Win11 25H2).
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class WinPtyProvider : IPtyProvider
{
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
            // Force a UTF-8 locale so the spawned shell/tools (bash, jq, curl) read and write
            // input as UTF-8 instead of the system code page — otherwise non-ASCII punctuation
            // an agent types (em-dashes, smart quotes) is mangled to the replacement char.
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
            ForceWinPty = true,
            Environment = env
        };

        connection = Task.Run(() => PtyProvider.SpawnAsync(options, CancellationToken.None))
            .GetAwaiter().GetResult();

        connection.ProcessExited += (_, e) => ProcessExited?.Invoke(e.ExitCode);

        readThread = new Thread(ReadLoop)
        {
            IsBackground = true,
            Name = "WinPTY-Read"
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

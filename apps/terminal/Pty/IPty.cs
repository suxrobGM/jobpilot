namespace JobPilot.Terminal.Pty;

/// <summary>PTY exit tagged with its process generation.</summary>
public readonly record struct PtyExit(int Generation, int ExitCode);

/// <summary>
/// Owns one PTY and tags events with a generation, allowing consumers to ignore a killed process that reports
/// its exit after a replacement has started.
/// </summary>
public interface IPty : IDisposable
{
    /// <summary>Raised when the active PTY emits output.</summary>
    event Action<byte[]>? OutputReceived;

    /// <summary>Raised when any started PTY exits.</summary>
    event Action<PtyExit>? ProcessExited;

    /// <summary>Starts a new PTY and returns its generation.</summary>
    /// <exception cref="PtyStartException">The process could not be spawned.</exception>
    int Start(
        string command,
        string[] args,
        string workingDirectory,
        int cols,
        int rows,
        IReadOnlyDictionary<string, string>? environment = null);

    void Write(byte[] data);

    void Resize(int cols, int rows);

    void Stop();
}

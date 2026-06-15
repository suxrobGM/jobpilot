namespace JobPilot.Terminal.Pty;

/// <summary>
/// Platform-specific adapter for spawning and controlling an interactive pseudo-terminal process.
/// </summary>
public interface IPtyProvider : IDisposable
{
    /// <summary>
    /// Starts a command inside a PTY with the requested working directory and viewport size.
    /// </summary>
    /// <param name="command">Executable to launch.</param>
    /// <param name="args">Command-line arguments passed to the executable.</param>
    /// <param name="workingDirectory">Working directory for the process.</param>
    /// <param name="cols">Initial terminal column count.</param>
    /// <param name="rows">Initial terminal row count.</param>
    /// <param name="environment">Additional environment variables exported to the spawned process.</param>
    void Start(
        string command,
        string[] args,
        string workingDirectory,
        int cols,
        int rows,
        IReadOnlyDictionary<string, string>? environment = null);

    /// <summary>
    /// Writes raw terminal input bytes to the PTY.
    /// </summary>
    /// <param name="data">Input bytes to write.</param>
    void Write(byte[] data);

    /// <summary>
    /// Resizes the PTY viewport.
    /// </summary>
    /// <param name="cols">New terminal column count.</param>
    /// <param name="rows">New terminal row count.</param>
    void Resize(int cols, int rows);

    /// <summary>
    /// Raised when the PTY emits output bytes.
    /// </summary>
    event Action<byte[]>? OutputReceived;

    /// <summary>
    /// Raised when the underlying process exits.
    /// </summary>
    event Action<int>? ProcessExited;
}

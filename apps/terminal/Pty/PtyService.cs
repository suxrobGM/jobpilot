namespace JobPilot.Terminal.Pty;

/// <summary>
/// Raised when a PTY provider fails to spawn the requested executable.
/// </summary>
public sealed class PtyStartException(string command, Exception innerException)
    : Exception($"Failed to start '{command}': {innerException.Message}", innerException)
{
    /// <summary>Gets the executable that failed to start.</summary>
    public string Command { get; } = command;
}

/// <summary>
/// Selects a platform PTY provider and exposes a stable service API for session management.
/// </summary>
public sealed class PtyService : IDisposable
{
    private IPtyProvider? provider;

    /// <summary>
    /// Raised when the active PTY emits output bytes.
    /// </summary>
    public event Action<byte[]>? OutputReceived;

    /// <summary>
    /// Raised when the active PTY process exits.
    /// </summary>
    public event Action<int>? ProcessExited;

    /// <summary>
    /// Starts a new PTY process, replacing any existing provider.
    /// </summary>
    /// <param name="command">Executable to launch.</param>
    /// <param name="args">Command-line arguments passed to the executable.</param>
    /// <param name="workingDirectory">Working directory for the process.</param>
    /// <param name="cols">Initial terminal column count.</param>
    /// <param name="rows">Initial terminal row count.</param>
    /// <param name="environment">Additional environment variables exported to the spawned process.</param>
    /// <exception cref="PtyStartException">Thrown when the underlying PTY provider fails to spawn the process.</exception>
    public void Start(
        string command,
        string[] args,
        string workingDirectory,
        int cols,
        int rows,
        IReadOnlyDictionary<string, string>? environment = null)
    {
        Stop();

        var next = CreateProvider();
        next.OutputReceived += data => OutputReceived?.Invoke(data);
        next.ProcessExited += code => ProcessExited?.Invoke(code);

        try
        {
            next.Start(command, args, workingDirectory, cols, rows, environment);
        }
        catch (Exception ex)
        {
            next.Dispose();

            var error = $"\e[31mFailed to start '{command}': {ex.Message}\e[0m\r\n";
            OutputReceived?.Invoke(System.Text.Encoding.UTF8.GetBytes(error));
            throw new PtyStartException(command, ex);
        }

        provider = next;
    }

    /// <summary>
    /// Writes raw terminal input bytes to the active PTY.
    /// </summary>
    /// <param name="data">Input bytes to write.</param>
    public void Write(byte[] data)
    {
        provider?.Write(data);
    }

    /// <summary>
    /// Resizes the active PTY viewport.
    /// </summary>
    /// <param name="cols">New terminal column count.</param>
    /// <param name="rows">New terminal row count.</param>
    public void Resize(int cols, int rows)
    {
        provider?.Resize(cols, rows);
    }

    /// <summary>
    /// Stops and disposes the active PTY provider, if one exists.
    /// </summary>
    public void Stop()
    {
        provider?.Dispose();
        provider = null;
    }

    /// <summary>
    /// Releases the active PTY provider.
    /// </summary>
    public void Dispose()
    {
        Stop();
    }

    private static IPtyProvider CreateProvider()
    {
        if (!OperatingSystem.IsWindows())
        {
            throw new PlatformNotSupportedException("Only Windows is supported");
        }

        return new PtyNetProvider();
    }
}

using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using JobPilot.Terminal.Models;
using JobPilot.Terminal.Pty;

namespace JobPilot.Terminal;

/// <summary>
/// Tracks whether the managed terminal process is currently available.
/// </summary>
public enum SessionState
{
    /// <summary>No terminal process is running.</summary>
    Stopped,

    /// <summary>A terminal process is running and may receive input.</summary>
    Running
}

/// <summary>
/// Coordinates the lifetime of the active provider PTY session and broadcasts PTY output to connected
/// WebSocket clients.
/// </summary>
public sealed class SessionManager : IDisposable
{
    private readonly PtyService pty;
    private readonly ILogger<SessionManager> logger;
    private readonly TerminalSessionPaths paths;
    private readonly ConcurrentDictionary<WebSocket, byte> clients = new();
    private readonly Lock stateLock = new();
    private SessionState state = SessionState.Stopped;
    private string activeProvider = TerminalProviders.Claude;
    private bool suppressNextExitMessage;

    /// <summary>
    /// Initializes a new <see cref="SessionManager"/> and subscribes to PTY output and exit events.
    /// </summary>
    /// <param name="pty">The PTY service used to start and control the terminal process.</param>
    /// <param name="logger">Logger for session lifecycle events.</param>
    public SessionManager(PtyService pty, ILogger<SessionManager> logger)
    {
        this.pty = pty;
        this.logger = logger;
        paths = TerminalSessionPaths.Resolve();

        pty.OutputReceived += OnPtyOutput;
        pty.ProcessExited += OnPtyExit;
    }

    /// <summary>
    /// Gets the current terminal session state.
    /// </summary>
    public SessionState State
    {
        get
        {
            lock (stateLock)
            {
                return state;
            }
        }
    }

    /// <summary>
    /// Gets the active or last requested terminal provider.
    /// </summary>
    public string ActiveProvider
    {
        get
        {
            lock (stateLock)
            {
                return activeProvider;
            }
        }
    }

    /// <summary>
    /// Gets every supported terminal provider.
    /// </summary>
    public static TerminalProviderInfo[] Providers => TerminalSessionPaths.Providers();

    /// <summary>
    /// Starts the provider PTY session if it is not already running.
    /// </summary>
    /// <param name="provider">Provider id to launch.</param>
    /// <param name="requestedWorkingDir">Optional working directory for the spawned process.</param>
    /// <param name="cols">Initial terminal column count.</param>
    /// <param name="rows">Initial terminal row count.</param>
    public void Start(string? provider, string? requestedWorkingDir, int cols, int rows)
    {
        lock (stateLock)
        {
            var normalizedProvider = TerminalProviders.Normalize(provider);
            if (state == SessionState.Running && activeProvider == normalizedProvider)
            {
                logger.LogInformation("{Provider} session already running; Start is a no-op.", normalizedProvider);
                return;
            }

            if (state == SessionState.Running)
            {
                logger.LogInformation(
                    "Switching terminal provider from {PreviousProvider} to {NextProvider}.", activeProvider,
                    normalizedProvider);
                suppressNextExitMessage = true;
                pty.Stop();
                state = SessionState.Stopped;
            }

            var workingDir = paths.ResolveWorkingDir(requestedWorkingDir);
            var spec = paths.GetLaunchSpec(normalizedProvider, workingDir);

            logger.LogInformation(
                "Starting {Provider}: cwd={Cwd} command={Command} args={Args} sharedSkillsDir={SharedSkillsDir} cols={Cols} rows={Rows}",
                spec.Provider.DisplayName,
                workingDir,
                spec.Command,
                string.Join(" ", spec.Args),
                paths.SharedSkillsDir,
                cols,
                rows);

            activeProvider = normalizedProvider;
            pty.Start(spec.Command, spec.Args, workingDir, cols, rows);
            state = SessionState.Running;
        }
    }

    /// <summary>
    /// Sends a full command line to the running session, appending carriage return when needed.
    /// </summary>
    /// <param name="command">Command text to inject into the PTY.</param>
    public void Inject(string command)
    {
        if (string.IsNullOrEmpty(command)) return;

        var line = command.EndsWith('\r') ? command : command + "\r";
        var bytes = Encoding.UTF8.GetBytes(line);
        pty.Write(bytes);
    }

    /// <summary>
    /// Resizes the active PTY viewport.
    /// </summary>
    /// <param name="cols">New terminal column count.</param>
    /// <param name="rows">New terminal row count.</param>
    public void Resize(int cols, int rows)
    {
        pty.Resize(cols, rows);
    }

    /// <summary>
    /// Writes raw UTF-8 or control-sequence bytes to the active PTY.
    /// </summary>
    /// <param name="data">Bytes received from a connected terminal client.</param>
    public void WriteInput(byte[] data)
    {
        pty.Write(data);
    }

    /// <summary>
    /// Stops the active PTY session and marks the session as stopped.
    /// </summary>
    public void Stop()
    {
        lock (stateLock)
        {
            if (state == SessionState.Stopped) return;
            logger.LogInformation("Stopping {Provider} session.", activeProvider);
            pty.Stop();
            state = SessionState.Stopped;
        }
    }

    /// <summary>
    /// Adds a WebSocket client to the output broadcast set.
    /// </summary>
    /// <param name="socket">The connected browser WebSocket.</param>
    public void RegisterClient(WebSocket socket)
    {
        clients.TryAdd(socket, 0);
    }

    /// <summary>
    /// Removes a WebSocket client from the output broadcast set.
    /// </summary>
    /// <param name="socket">The disconnected browser WebSocket.</param>
    public void UnregisterClient(WebSocket socket)
    {
        clients.TryRemove(socket, out _);
    }

    private void OnPtyOutput(byte[] data)
    {
        Broadcast(data);
    }

    private void OnPtyExit(int code)
    {
        string provider;
        bool suppressMessage;
        lock (stateLock)
        {
            provider = activeProvider;
            suppressMessage = suppressNextExitMessage;
            suppressNextExitMessage = false;
            if (!suppressMessage)
            {
                state = SessionState.Stopped;
            }
        }

        if (suppressMessage) return;

        var displayName = provider == TerminalProviders.Codex ? "Codex" : "Claude Code";
        var msg = $"\r\n\e[31m[JobPilot.Terminal] {displayName} exited with code {code}. Use Restart to reopen.\e[0m\r\n";
        Broadcast(Encoding.UTF8.GetBytes(msg));
    }

    private void Broadcast(byte[] data)
    {
        foreach (var socket in clients.Keys)
        {
            if (socket.State != WebSocketState.Open) continue;
            try
            {
                socket.SendAsync(data, WebSocketMessageType.Binary, endOfMessage: true, CancellationToken.None);
            }
            catch (Exception ex)
            {
                logger.LogDebug(ex, "Broadcast to client failed; will be cleaned up on next disconnect.");
            }
        }
    }

    /// <summary>
    /// Stops the PTY session and detaches event handlers.
    /// </summary>
    public void Dispose()
    {
        Stop();
        pty.OutputReceived -= OnPtyOutput;
        pty.ProcessExited -= OnPtyExit;
    }
}

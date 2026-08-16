using System.Text;
using JobPilot.Terminal.Hosting;
using JobPilot.Terminal.Contracts;
using JobPilot.Terminal.Pty;

namespace JobPilot.Terminal.Sessions;

/// <summary>Owns the active provider session and exposes its output and exit events.</summary>
public sealed class SessionManager : IDisposable
{
    private static readonly byte[] EnterKey = "\r"u8.ToArray();

    // Sending Enter separately prevents provider TUIs from treating it as pasted text.
    private static readonly TimeSpan SubmitKeyDelay = TimeSpan.FromMilliseconds(75);

    private readonly IPty pty;
    private readonly ILogger<SessionManager> logger;
    private readonly HostInstall install;
    private readonly ScratchCleaner scratch;
    private readonly Lock stateLock = new();

    private volatile SessionState state = SessionState.Stopped;
    private volatile string activeProvider = TerminalProviders.Claude;

    // A killed PTY can exit after its replacement starts, so only this generation may change session state.
    private int liveGeneration;

    public SessionManager(IPty pty, HostInstall install, ScratchCleaner scratch, ILogger<SessionManager> logger)
    {
        this.pty = pty;
        this.install = install;
        this.scratch = scratch;
        this.logger = logger;

        pty.OutputReceived += OnPtyOutput;
        pty.ProcessExited += OnPtyExit;
    }

    /// <summary>Raised for terminal output.</summary>
    public event Action<byte[]>? Output;

    /// <summary>Raised just before a new provider session spawns, so replay buffers reset ahead of its output.</summary>
    public event Action? Starting;

    /// <summary>Raised when the current process exits.</summary>
    public event Action<SessionExit>? Exited;

    /// <summary>Current session state.</summary>
    public SessionState State => state;

    /// <summary>Active or last requested provider.</summary>
    public string ActiveProvider => activeProvider;

    /// <summary>Starts a provider unless that provider is already running.</summary>
    /// <exception cref="PtyStartException">Thrown when the PTY provider fails to spawn the process.</exception>
    public void Start(SessionStartOptions options)
    {
        lock (stateLock)
        {
            var sessionPaths = install.RequirePaths();

            var normalizedProvider = TerminalProviders.Normalize(options.Provider);
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
                // Disown the outgoing PTY before its asynchronous exit arrives.
                liveGeneration = 0;
                pty.Stop();
                state = SessionState.Stopped;
            }

            var workingDir = sessionPaths.WorkingDir;
            scratch.CleanSessionStart(workingDir);
            var spec = TerminalProviders.GetLaunchSpec(normalizedProvider, sessionPaths.PluginDir, workingDir, logger);

            logger.LogInformation(
                "Starting {Provider}: cwd={Cwd} command={Command} args={Args} skillsDir={SkillsDir} cols={Cols} rows={Rows}",
                spec.Provider.DisplayName,
                workingDir,
                spec.Command,
                string.Join(" ", spec.Args),
                sessionPaths.SkillsDir,
                options.Cols,
                options.Rows);

            static string FromRequestOrEnv(string? passed, string envKey, string fallback) =>
                !string.IsNullOrEmpty(passed) ? passed : Environment.GetEnvironmentVariable(envKey) ?? fallback;

            var env = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["JOBPILOT_SKILLS_ROOT"] = sessionPaths.SkillsDir,
                ["JOBPILOT_WORKSPACE_ROOT"] = workingDir,
                ["JOBPILOT_API"] = FromRequestOrEnv(options.ApiUrl, "JOBPILOT_API", "http://localhost:4101"),
                ["JOBPILOT_API_TOKEN"] = FromRequestOrEnv(options.ApiToken, "JOBPILOT_API_TOKEN", ""),
                ["JOBPILOT_WEB"] = FromRequestOrEnv(options.WebUrl, "JOBPILOT_WEB", "http://localhost:4100")
            };

            Starting?.Invoke();

            try
            {
                liveGeneration = pty.Start(spec.Command, spec.Args, workingDir, options.Cols, options.Rows, env);
            }
            catch (PtyStartException ex)
            {
                liveGeneration = 0;
                state = SessionState.Stopped;
                logger.LogError(ex, "Failed to start {Provider} PTY.", normalizedProvider);
                throw;
            }

            activeProvider = normalizedProvider;
            state = SessionState.Running;
        }
    }

    /// <summary>Writes and submits a command to the active session.</summary>
    /// <exception cref="ArgumentException">The expected provider id is not a known provider.</exception>
    public async Task<InjectResult> Inject(
        string command,
        string? expectedProvider = null,
        CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(command);

        int generation;
        lock (stateLock)
        {
            if (state != SessionState.Running) return InjectResult.NotRunning;

            if (expectedProvider is not null)
            {
                var normalized = TerminalProviders.Normalize(expectedProvider);
                if (normalized != activeProvider)
                {
                    logger.LogWarning(
                        "Rejected inject: expected provider {Expected} but {Actual} is active.",
                        normalized, activeProvider);
                    return InjectResult.ProviderMismatch;
                }
            }

            generation = liveGeneration;

            pty.Write(Encoding.UTF8.GetBytes(command));
        }

        await Task.Delay(SubmitKeyDelay, ct);

        lock (stateLock)
        {
            // A provider switch during the delay must not receive Enter for a command it never saw.
            if (state != SessionState.Running || liveGeneration != generation)
            {
                logger.LogWarning("Dropped the submit key: the session ended or was replaced mid-inject.");
                return InjectResult.NotRunning;
            }

            pty.Write(EnterKey);
        }

        return InjectResult.Injected;
    }

    public void Resize(int cols, int rows)
    {
        pty.Resize(cols, rows);
    }

    public void WriteInput(byte[] data)
    {
        pty.Write(data);
    }

    public void Stop()
    {
        lock (stateLock)
        {
            if (state == SessionState.Stopped) return;
            logger.LogInformation("Stopping {Provider} session.", activeProvider);
            state = SessionState.Stopped;
            pty.Stop();
        }
    }

    private void OnPtyOutput(byte[] data) => Output?.Invoke(data);

    private void OnPtyExit(PtyExit exit)
    {
        string provider;
        bool requested;
        lock (stateLock)
        {
            // Ignore exits from replaced or already-reported PTYs.
            if (exit.Generation != liveGeneration) return;

            liveGeneration = 0;
            provider = activeProvider;
            // Stop() marks Stopped before killing the PTY, so a live generation still Running exited on its own.
            requested = state == SessionState.Stopped;
            state = SessionState.Stopped;
        }

        Exited?.Invoke(new SessionExit(TerminalProviders.GetDisplayName(provider), exit.ExitCode, requested));
    }

    public void Dispose()
    {
        Stop();
        pty.OutputReceived -= OnPtyOutput;
        pty.ProcessExited -= OnPtyExit;
    }
}

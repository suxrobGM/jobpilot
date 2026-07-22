using System.Threading.Channels;
using JobPilot.Terminal.Contracts;
using JobPilot.Terminal.Sessions;

namespace JobPilot.Terminal.Pilot;

/// <summary>Drives the real PTY for the Pilot loop, detecting cycle sentinels in the session's output stream.</summary>
public sealed class PilotRuntime : IPilotRuntime, IDisposable
{
    private const string PilotSkill = "pilot";
    private const int PilotCols = 220;
    private const int PilotRows = 50;

    private static readonly TimeSpan StartupGrace = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan MismatchPoll = TimeSpan.FromSeconds(5);

    // Redraw time between /clear and the cycle inject landing on the fresh prompt.
    private static readonly TimeSpan ClearSettle = TimeSpan.FromSeconds(2);

    // Graduated unstick directives; skip also fails the claimed task. The shared tail spells out the cycle
    // detail - without it /api/pilot/activity can't read the entry as a completion.
    private const string ErrorExitDirective =
        "journal the error batch (system + cycle with detail:{\"status\":\"error\",\"sleepSeconds\":300}), "
        + "and print the error sentinel.";

    private const string CheckInCommand =
        "Checking in: you appear stuck. Release your claim, " + ErrorExitDirective;
    private const string SkipCommand =
        "Stop the current action. Fail the claimed task, " + ErrorExitDirective;

    private readonly SessionManager session;
    private readonly PilotStore store;
    private readonly PilotApiClient api;
    private readonly ILogger<PilotRuntime> logger;
    private readonly SentinelParser parser = new();
    private readonly StuckDetector stuck = new();

    // Same output event TerminalHub taps; a single-reader channel merges sentinels and stuck signals into one await.
    // Not single-writer: the PTY thread writes signals while the coordinator re-enqueues drained sentinels.
    private readonly Channel<WaitSignal> signals = Channel.CreateUnbounded<WaitSignal>(
        new UnboundedChannelOptions { SingleReader = true });

    public PilotRuntime(SessionManager session, PilotStore store, PilotApiClient api, ILogger<PilotRuntime> logger)
    {
        this.session = session;
        this.store = store;
        this.api = api;
        this.logger = logger;
        session.Output += OnOutput;
    }

    public string? RunningProvider => session.State == SessionState.Running ? session.ActiveProvider : null;

    public void StartSession(PilotPairing pairing) => session.Start(new SessionStartOptions(
        pairing.Provider,
        PilotCols,
        PilotRows,
        pairing.ApiToken,
        pairing.ApiUrl,
        pairing.WebUrl));

    public Task WaitStartupGraceAsync(CancellationToken ct) => Task.Delay(StartupGrace, ct);

    public async Task InjectCycleAsync(PilotPairing pairing, CancellationToken ct)
    {
        // Cycles are stateless (state lives in the API): clearing first prevents mid-cycle auto-compaction
        // and keeps untrusted page content from lingering across cycles.
        await InjectAsync(TerminalProviders.ClearCommand, pairing.Provider, "clear", ct);
        await Task.Delay(ClearSettle, ct);

        DrainSignals();  // Discard signals buffered before this injection
        stuck.Reset();
        var command = TerminalProviders.FormatSkillCommand(pairing.Provider, PilotSkill);
        await InjectAsync(command, pairing.Provider, "cycle", ct);
    }

    public Task InjectCheckInAsync(PilotPairing pairing, CancellationToken ct) =>
        InjectDirectiveAsync(CheckInCommand, "check-in", pairing, ct);

    public Task InjectSkipAsync(PilotPairing pairing, CancellationToken ct) =>
        InjectDirectiveAsync(SkipCommand, "skip", pairing, ct);

    // Ladder directives keep the stuck cycle's context - no clear, and racing sentinels survive the drain.
    private Task InjectDirectiveAsync(string command, string what, PilotPairing pairing, CancellationToken ct)
    {
        stuck.Reset();
        DrainStuckSignals();
        return InjectAsync(command, pairing.Provider, what, ct);
    }

    private async Task InjectAsync(string command, string provider, string what, CancellationToken ct)
    {
        var result = await session.Inject(command, provider, ct);
        if (result != InjectResult.Injected)
        {
            logger.LogWarning("Pilot {What} inject was rejected ({Result}).", what, result);
        }
    }

    public async Task<PilotWaitResult> AwaitSentinelAsync(TimeSpan timeout, CancellationToken ct)
    {
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var exited = false;
        void OnExit(SessionExit _)
        {
            exited = true;
            timeoutCts.Cancel();
        }

        // Subscribe before the state check: Exited is non-latching, so an exit landing between the check and the
        // subscription would never be observed and the wait would burn the full timeout on a dead PTY.
        session.Exited += OnExit;
        try
        {
            if (session.State != SessionState.Running)
            {
                return PilotWaitResult.Exited;
            }

            timeoutCts.CancelAfter(timeout);
            var signal = await signals.Reader.ReadAsync(timeoutCts.Token);
            return signal.Cycle is { } cycle
                ? PilotWaitResult.Sentinel(cycle)
                : PilotWaitResult.Stuck;
        }
        catch (OperationCanceledException)
        {
            if (ct.IsCancellationRequested)
            {
                throw; // pilot disabled or host shutting down
            }
            return exited ? PilotWaitResult.Exited : PilotWaitResult.Timeout;
        }
        finally
        {
            session.Exited -= OnExit;
        }
    }

    public Task SleepAsync(TimeSpan duration, CancellationToken ct) => Task.Delay(duration, ct);

    public void StopSession() => session.Stop();

    // Esc is the interrupt key in both provider TUIs; at an idle prompt it is a harmless no-op.
    public void InterruptSession()
    {
        if (session.State == SessionState.Running)
        {
            session.WriteInput([0x1b]);
        }
    }

    public Task PauseAsync(CancellationToken ct) => Task.Delay(MismatchPoll, ct);

    public async Task ReportSystemAsync(string summary, CancellationToken ct)
    {
        var pairing = store.Current;
        if (pairing is not null)
        {
            await api.ReportSystemAsync(pairing.ApiUrl, pairing.ApiToken, summary, ct);
        }
    }

    public async Task<PilotActivitySnapshot?> GetActivityAsync(CancellationToken ct)
    {
        var pairing = store.Current;
        return pairing is null ? null : await api.GetActivityAsync(pairing.ApiUrl, pairing.ApiToken, ct);
    }

    public async Task<bool?> GetRunStateAsync(CancellationToken ct)
    {
        var pairing = store.Current;
        return pairing is null ? null : await api.GetRunningAsync(pairing.ApiUrl, pairing.ApiToken, ct);
    }

    private void OnOutput(byte[] data)
    {
        // Interactive non-pilot sessions must not pay parser cost per chunk; start writes the store before the
        // first cycle inject and stop cancels the iteration, so no sentinel a live cycle depends on is lost.
        if (store.Current is not { Running: true })
        {
            return;
        }

        var sawSentinel = false;
        foreach (var cycle in parser.Feed(data))
        {
            sawSentinel = true;
            signals.Writer.TryWrite(WaitSignal.Sentinel(cycle));
        }

        // A completed cycle clears stuck evidence before the next one accumulates its own.
        if (sawSentinel)
        {
            stuck.Reset();
            return;
        }

        var reason = stuck.Feed(data, DateTimeOffset.UtcNow);
        if (reason != PilotStuckReason.None)
        {
            logger.LogDebug("Pilot stuck heuristic fired ({Reason}).", reason);
            signals.Writer.TryWrite(WaitSignal.Stuck);
        }
    }

    private void DrainSignals()
    {
        while (signals.Reader.TryRead(out _))
        {
        }
    }

    // Stuck evidence re-armed during the ladder's report+inject gap would instantly consume the next grace, but a
    // real cycle sentinel racing in during that gap must survive, so only stuck signals are discarded.
    private void DrainStuckSignals()
    {
        List<WaitSignal>? sentinels = null;
        while (signals.Reader.TryRead(out var signal))
        {
            if (signal.Cycle is not null)
            {
                (sentinels ??= []).Add(signal);
            }
        }

        if (sentinels is not null)
        {
            foreach (var signal in sentinels)
            {
                signals.Writer.TryWrite(signal);
            }
        }
    }

    public void Dispose() => session.Output -= OnOutput;

    /// <summary>A sentinel cycle or a fired stuck heuristic, merged onto one channel so the await sees whichever wins.</summary>
    private readonly record struct WaitSignal(PilotCycle? Cycle)
    {
        public static WaitSignal Sentinel(PilotCycle cycle) => new(cycle);

        public static readonly WaitSignal Stuck = new(null);
    }
}

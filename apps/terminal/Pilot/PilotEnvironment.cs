using System.Threading.Channels;
using JobPilot.Terminal.Contracts;
using JobPilot.Terminal.Sessions;

namespace JobPilot.Terminal.Pilot;

/// <summary>Drives the real PTY for the Pilot loop, detecting cycle sentinels in the session's output stream.</summary>
public sealed class PilotEnvironment : IPilotEnvironment, IDisposable
{
    private const string PilotSkill = "pilot";
    private const int PilotCols = 220;
    private const int PilotRows = 50;

    private static readonly TimeSpan StartupGrace = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan MismatchPoll = TimeSpan.FromSeconds(5);

    // Nudge and skip are graduated unstick directives; the skip forces the leased work failed so the cycle moves on.
    private const string NudgeCommand =
        "You appear stuck. Release your lease, journal the failure, and print the cycle sentinel.";
    private const string SkipCommand =
        "Stop the current action. Record the leased work as failed, journal why, and print the cycle sentinel.";

    private readonly SessionManager session;
    private readonly PilotStore store;
    private readonly PilotApiClient api;
    private readonly ILogger<PilotEnvironment> logger;
    private readonly SentinelParser parser = new();
    private readonly StallDetector stall = new();

    // Same output event TerminalHub taps; a single-reader channel merges sentinels and stalls into one await.
    private readonly Channel<WaitSignal> signals = Channel.CreateUnbounded<WaitSignal>(
        new UnboundedChannelOptions { SingleReader = true, SingleWriter = true });

    public PilotEnvironment(SessionManager session, PilotStore store, PilotApiClient api, ILogger<PilotEnvironment> logger)
    {
        this.session = session;
        this.store = store;
        this.api = api;
        this.logger = logger;
        session.Output += OnOutput;
    }

    public string? RunningProvider => session.State == SessionState.Running ? session.ActiveProvider : null;

    public void StartSession(PilotPairing pairing) =>
        session.Start(pairing.Provider, PilotCols, PilotRows, pairing.ApiToken, pairing.WebUrl, pairing.ApiUrl);

    public Task WaitStartupGraceAsync(CancellationToken ct) => Task.Delay(StartupGrace, ct);

    public async Task InjectCycleAsync(PilotPairing pairing, CancellationToken ct)
    {
        DrainSignals();  // Discard any signal buffered before this injection so the await only sees the new cycle.
        stall.Reset();
        var command = TerminalProviders.FormatSkillCommand(pairing.Provider, PilotSkill);
        var result = await session.Inject(command, pairing.Provider);
        if (result != InjectResult.Injected)
        {
            logger.LogWarning("Pilot cycle inject was rejected ({Result}).", result);
        }
    }

    public async Task InjectNudgeAsync(PilotPairing pairing, CancellationToken ct)
    {
        var result = await session.Inject(NudgeCommand, pairing.Provider);
        if (result != InjectResult.Injected)
        {
            logger.LogWarning("Pilot nudge inject was rejected ({Result}).", result);
        }
    }

    public async Task InjectSkipAsync(PilotPairing pairing, CancellationToken ct)
    {
        var result = await session.Inject(SkipCommand, pairing.Provider);
        if (result != InjectResult.Injected)
        {
            logger.LogWarning("Pilot skip inject was rejected ({Result}).", result);
        }
    }

    public async Task<PilotWaitResult> AwaitSentinelAsync(TimeSpan timeout, CancellationToken ct)
    {
        if (session.State != SessionState.Running)
        {
            return PilotWaitResult.Exited;
        }

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var exited = false;
        void OnExit(SessionExit _)
        {
            exited = true;
            timeoutCts.Cancel();
        }

        session.Exited += OnExit;
        try
        {
            timeoutCts.CancelAfter(timeout);
            var signal = await signals.Reader.ReadAsync(timeoutCts.Token);
            return signal.Cycle is { } cycle
                ? PilotWaitResult.Sentinel(cycle)
                : PilotWaitResult.Stalled(signal.Stall);
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

    public Task PauseAsync(CancellationToken ct) => Task.Delay(MismatchPoll, ct);

    public async Task ReportSystemAsync(string summary)
    {
        var pairing = store.Current;
        if (pairing is not null)
        {
            await api.ReportSystemAsync(pairing.ApiUrl, pairing.ApiToken, summary);
        }
    }

    private void OnOutput(byte[] data)
    {
        var sawSentinel = false;
        foreach (var cycle in parser.Feed(data))
        {
            sawSentinel = true;
            signals.Writer.TryWrite(WaitSignal.Sentinel(cycle));
        }

        // A completed cycle clears stall evidence before the next one accumulates its own.
        if (sawSentinel)
        {
            stall.Reset();
            return;
        }

        var reason = stall.Feed(data, DateTimeOffset.UtcNow);
        if (reason != PilotStallReason.None)
        {
            signals.Writer.TryWrite(WaitSignal.Stalled(reason));
        }
    }

    private void DrainSignals()
    {
        while (signals.Reader.TryRead(out _))
        {
        }
    }

    public void Dispose() => session.Output -= OnOutput;

    /// <summary>A sentinel cycle or a fired stall heuristic, merged onto one channel so the await sees whichever wins.</summary>
    private readonly record struct WaitSignal(PilotCycle? Cycle, PilotStallReason Stall)
    {
        public static WaitSignal Sentinel(PilotCycle cycle) => new(cycle, PilotStallReason.None);

        public static WaitSignal Stalled(PilotStallReason reason) => new(null, reason);
    }
}

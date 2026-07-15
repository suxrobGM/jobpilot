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

    // Matches the sentinel the pilot skill prints as its final line.
    private const string NudgeCommand =
        "You appear stuck. Release your lease, journal the failure, and print the cycle sentinel.";

    private readonly SessionManager session;
    private readonly ILogger<PilotEnvironment> logger;
    private readonly SentinelParser parser = new();

    // Same output event TerminalHub taps; the parser is the only consumer, so a single-reader channel suffices.
    private readonly Channel<PilotCycle> cycles = Channel.CreateUnbounded<PilotCycle>(
        new UnboundedChannelOptions { SingleReader = true, SingleWriter = true });

    public PilotEnvironment(SessionManager session, ILogger<PilotEnvironment> logger)
    {
        this.session = session;
        this.logger = logger;
        session.Output += OnOutput;
    }

    public string? RunningProvider => session.State == SessionState.Running ? session.ActiveProvider : null;

    public void StartSession(PilotPairing pairing) =>
        session.Start(pairing.Provider, PilotCols, PilotRows, pairing.ApiToken, pairing.WebUrl, pairing.ApiUrl);

    public Task WaitStartupGraceAsync(CancellationToken ct) => Task.Delay(StartupGrace, ct);

    public async Task InjectCycleAsync(PilotPairing pairing, CancellationToken ct)
    {
        DrainCycles(); // Discard any sentinel buffered before this injection so the await only sees the new cycle.
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
            var cycle = await cycles.Reader.ReadAsync(timeoutCts.Token);
            return PilotWaitResult.Sentinel(cycle);
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

    private void OnOutput(byte[] data)
    {
        foreach (var cycle in parser.Feed(data))
        {
            cycles.Writer.TryWrite(cycle);
        }
    }

    private void DrainCycles()
    {
        while (cycles.Reader.TryRead(out _))
        {
        }
    }

    public void Dispose() => session.Output -= OnOutput;
}

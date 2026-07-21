using JobPilot.Terminal.Common;

namespace JobPilot.Terminal.Pilot;

/// <summary>
/// Orchestrates one Pilot cycle: pick up or restart the session, probe the completion baseline, inject the skill,
/// wait for the sentinel, and hand a stuck run to the intervention ladder. The heavy wait/completion logic lives in
/// <see cref="CycleWaiter"/> and <see cref="CompletionTracker"/>; the ladder in <see cref="InterventionLadder"/>. The
/// runner returns the inter-cycle sleep to the coordinator instead of sleeping itself, so a wake can end it early.
/// </summary>
public sealed class PilotCycleRunner
{
    public static readonly TimeSpan SentinelTimeout = TimeSpan.FromMinutes(20);
    public static readonly TimeSpan CheckInGrace = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan BackoffDelay = TimeSpan.FromMinutes(30);

    // How long each sentinel-wait slice runs before consulting the server for a completion the TUI may have garbled.
    public static readonly TimeSpan CompletionPollInterval = TimeSpan.FromMinutes(2);

    // A cycle whose last server-side activity is fresher than this is working, not stuck; the ladder is deferred.
    public static readonly TimeSpan LivenessWindow = TimeSpan.FromMinutes(5);

    // Hard cap on how long one cycle may keep extending on positive liveness before the ladder runs regardless.
    public static readonly TimeSpan MaxCycleWait = TimeSpan.FromMinutes(60);

    // Back off only after a broken install restarts this many cycles in a row, so recovery does not hot-loop.
    public const int BackoffThreshold = 3;

    public const int MinSleepSeconds = 15;
    public const int MaxSleepSeconds = 21600;

    private readonly IPilotRuntime env;
    private readonly TimeSpan pollInterval;
    private readonly CompletionTracker completion = new();
    private readonly InterventionLadder ladder;

    public PilotCycleRunner(IPilotRuntime env)
        : this(env, CompletionPollInterval)
    {
    }

    // Test seam: a poll interval >= the wait windows collapses each wait to a single slice for deterministic asserts.
    internal PilotCycleRunner(IPilotRuntime env, TimeSpan pollInterval)
    {
        this.env = env;
        this.pollInterval = pollInterval;
        ladder = new InterventionLadder(env, FinishAsync, ReportAsync);
    }

    /// <summary>Consecutive restarts; reset by any completed cycle.</summary>
    public int ConsecutiveTimeouts => ladder.ConsecutiveRestarts;

    /// <summary>Consecutive mid-wait session exits; reset by any completed cycle.</summary>
    internal int ConsecutiveSessionExits { get; private set; }

    public DateTimeOffset? LastCycleAt { get; private set; }

    public PilotCycleStatus? LastCycleStatus { get; private set; }

    /// <summary>False while paused on a user-driven provider mismatch.</summary>
    public bool Conducting { get; private set; }

    public static int ClampSleep(int seconds) => Math.Clamp(seconds, MinSleepSeconds, MaxSleepSeconds);

    /// <summary>
    /// Runs one cycle; the caller loops while pilot mode stays enabled. Returns the inter-cycle sleep to await
    /// (already clamped), or null to loop immediately (paused, restarted, or backed off internally).
    /// </summary>
    public async Task<TimeSpan?> RunIterationAsync(PilotPairing pairing, CancellationToken ct)
    {
        // Never fight a user who manually launched the other provider: pause instead of killing their session.
        var running = env.RunningProvider;
        if (running is not null && running != pairing.Provider)
        {
            Conducting = false;
            await env.PauseAsync(ct);
            return null;
        }

        Conducting = true;

        if (env.RunningProvider is null)
        {
            env.StartSession(pairing);
            await env.WaitStartupGraceAsync(ct);
        }

        // Memoize the server's current completion before injecting so the fallback can tell a fresh finish from an old one.
        completion.Prime(await ProbeAsync(ct));
        await env.InjectCycleAsync(pairing, ct);

        var waiter = new CycleWaiter(env, completion, pollInterval, ProbeAsync, ReportAsync);
        var resolution = await FinishAsync(await waiter.WaitAsync(SentinelTimeout, ct), ct);
        if (!resolution.Finished)
        {
            resolution = await ladder.ClimbAsync(pairing, waiter, ct);
        }

        return resolution.Sleep;
    }

    /// <summary>
    /// On resume after a host restart, primes the completion baseline from a fresh probe and returns how much of a
    /// previously announced inter-cycle sleep is still owed, so a restart does not skip a planned break.
    /// </summary>
    public async Task<TimeSpan> PrimeResumeAsync(CancellationToken ct) =>
        completion.PrimeResume(await ProbeAsync(ct));

    /// <summary>Interprets a wait result: finish on a sentinel or a dead session, otherwise let the ladder climb.</summary>
    private async Task<CycleResolution> FinishAsync(PilotWaitResult result, CancellationToken ct)
    {
        // The session died on its own; the next iteration restarts it, so no intervention is owed -
        // unless it keeps dying on startup (broken install/auth), which must back off, not hot-loop every ~15s.
        if (result.Outcome == PilotWaitOutcome.SessionExited)
        {
            ConsecutiveSessionExits++;
            if (ConsecutiveSessionExits >= BackoffThreshold)
            {
                await ReportAsync(PilotReports.ExitBackoff, ct);
                await env.SleepAsync(BackoffDelay, ct);
                ConsecutiveSessionExits = 0;
            }
            return CycleResolution.LoopNow;
        }

        if (result.Outcome != PilotWaitOutcome.Sentinel)
        {
            return CycleResolution.Climb; // Timeout or a stuck heuristic fired: climb the ladder.
        }

        ladder.Reset();
        ConsecutiveSessionExits = 0;
        LastCycleAt = DateTimeOffset.UtcNow;
        LastCycleStatus = result.Cycle.Status;
        return CycleResolution.SleepFor(TimeSpan.FromSeconds(ClampSleep(result.Cycle.SleepSeconds)));
    }

    // Best-effort probe: swallows a probe that throws or returns null; caller cancellation propagates.
    private async Task<PilotActivitySnapshot?> ProbeAsync(CancellationToken ct)
    {
        try
        {
            return await env.GetActivityAsync(ct);
        }
        catch (Exception ex) when (!Cancellation.IsCallerCancellation(ex, ct))
        {
            return null;
        }
    }

    // Reporting is best-effort: the env swallows delivery errors, but guard here too so a future env
    // change can never wedge a cycle on a failed journal push.
    private async Task ReportAsync(string summary, CancellationToken ct)
    {
        try
        {
            await env.ReportSystemAsync(summary, ct);
        }
        catch (Exception ex) when (!Cancellation.IsCallerCancellation(ex, ct))
        {
        }
    }
}

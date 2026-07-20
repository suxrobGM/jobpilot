namespace JobPilot.Terminal.Pilot;

/// <summary>
/// The Pilot's per-cycle state machine: ensure a session, inject the skill, await its sentinel, and on a wedge
/// nudge then kill. Pure of timing and PTY details (both live behind <see cref="IPilotEnvironment"/>) so the
/// sentinel/nudge/kill ordering and backoff can be unit-tested.
/// </summary>
public sealed class PilotLoop(IPilotEnvironment env)
{
    public static readonly TimeSpan SentinelTimeout = TimeSpan.FromMinutes(20);
    public static readonly TimeSpan NudgeGrace = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan BackoffDelay = TimeSpan.FromMinutes(30);

    // A cycle whose last server-side activity is fresher than this is working, not wedged; the ladder is deferred.
    public static readonly TimeSpan LivenessWindow = TimeSpan.FromMinutes(5);

    // Hard cap on how long one cycle may keep extending on positive liveness before the ladder runs regardless.
    public static readonly TimeSpan MaxCycleWait = TimeSpan.FromMinutes(60);

    // Back off only after a broken install kills this many cycles in a row, so recovery does not hot-loop.
    public const int BackoffThreshold = 3;

    public const int MinSleepSeconds = 15;
    public const int MaxSleepSeconds = 21600;

    // Stable, user-facing intervention summaries pushed to the API journal (the phone hears about these).
    public const string NudgeReport = "Pilot watchdog: cycle stalled - nudged the agent.";
    public const string SkipReport = "Pilot watchdog: still stalled after the nudge - told the agent to skip and fail the leased work.";
    public const string KillReport = "Pilot watchdog: agent unresponsive - restarted the session; the leased job will recover by TTL.";
    public const string BackoffReport = "Pilot watchdog: 3 consecutive stalls - backing off 30m.";
    public const string ExitBackoffReport =
        "Pilot watchdog: the provider CLI keeps exiting right after startup - check its install and auth - backing off 30m.";
    public const string ExtendReport =
        "Pilot watchdog: cycle running long but the API shows activity - extending the wait.";

    private readonly IPilotEnvironment env = env;

    /// <summary>Consecutive watchdog kills; reset by any completed cycle.</summary>
    public int ConsecutiveTimeouts { get; private set; }

    /// <summary>Consecutive mid-wait session exits; reset by any completed cycle.</summary>
    public int ConsecutiveSessionExits { get; private set; }

    public DateTimeOffset? LastCycleAt { get; private set; }

    public PilotCycleStatus? LastCycleStatus { get; private set; }

    /// <summary>False while paused on a user-driven provider mismatch.</summary>
    public bool Conducting { get; private set; }

    public static int ClampSleep(int seconds) => Math.Clamp(seconds, MinSleepSeconds, MaxSleepSeconds);

    /// <summary>Runs one cycle; the caller loops while pilot mode stays enabled.</summary>
    public async Task RunIterationAsync(PilotPairing pairing, CancellationToken ct)
    {
        // Never fight a user who manually launched the other provider: pause instead of killing their session.
        var running = env.RunningProvider;
        if (running is not null && running != pairing.Provider)
        {
            Conducting = false;
            await env.PauseAsync(ct);
            return;
        }

        Conducting = true;

        if (env.RunningProvider is null)
        {
            env.StartSession(pairing);
            await env.WaitStartupGraceAsync(ct);
        }

        await env.InjectCycleAsync(pairing, ct);

        // Positive liveness gates the ladder: a wedge that the API still shows as active is a slow cycle, not a
        // stuck one, so re-await instead of nudging - but only up to MaxCycleWait, and journal the extension once.
        // The wait owns that budget and one-shot flag so the ladder below reads as plain rungs.
        var wait = new CycleWait(this, ct);

        // T5 ladder: each wedge (timeout or a stall heuristic firing early) climbs one rung - nudge, then skip, then kill.
        var result = await wait.ExtendWhileLiveAsync(await wait.AwaitAsync(SentinelTimeout));
        if (await TryFinishAsync(result, ct))
        {
            return; // slept until the next cycle, or the session died and restarts next iteration
        }

        // Rung 1: nudge exactly once, then a shorter grace.
        await ReportAsync(NudgeReport);
        await env.InjectNudgeAsync(pairing, ct);
        result = await wait.AwaitAsync(NudgeGrace);
        if (await TryFinishAsync(result, ct))
        {
            return;
        }

        // Probe once more before skipping: the agent may have resumed writing during or after the nudge grace.
        result = await wait.ExtendWhileLiveAsync(result);
        if (await TryFinishAsync(result, ct))
        {
            return;
        }

        // Rung 2: the nudge did not unstick it - force the leased work failed so the next cycle can move on.
        await ReportAsync(SkipReport);
        await env.InjectSkipAsync(pairing, ct);
        result = await wait.AwaitAsync(NudgeGrace);
        if (await TryFinishAsync(result, ct))
        {
            return;
        }

        // Rung 3: still wedged - kill for a clean restart, and back off once repeated kills prove the install is broken.
        ConsecutiveTimeouts++;
        await ReportAsync(KillReport);
        env.StopSession();
        if (ConsecutiveTimeouts >= BackoffThreshold)
        {
            await ReportAsync(BackoffReport);
            await env.SleepAsync(BackoffDelay, ct);
        }
    }

    private static bool IsWedge(PilotWaitResult result) =>
        result.Outcome is PilotWaitOutcome.Timeout or PilotWaitOutcome.StallDetected;

    // Best-effort like ReportAsync: a probe that throws or returns null is treated as "not fresh" so the ladder runs.
    private async Task<bool> IsActivityFreshAsync(CancellationToken ct)
    {
        try
        {
            var lastActivity = await env.GetLastActivityAsync(ct);
            return lastActivity is { } at && DateTimeOffset.UtcNow - at < LivenessWindow;
        }
        catch
        {
            return false;
        }
    }

    // Reporting is best-effort: the env swallows delivery errors, but guard here too so a future env
    // change can never wedge a cycle on a failed journal push.
    private async Task ReportAsync(string summary)
    {
        try
        {
            await env.ReportSystemAsync(summary);
        }
        catch
        {
        }
    }

    /// <summary>Ends the cycle on a sentinel (sleep) or a dead session; returns false to climb the next ladder rung.</summary>
    private async Task<bool> TryFinishAsync(PilotWaitResult result, CancellationToken ct)
    {
        // The session died on its own; the next iteration restarts it, so no intervention is owed -
        // unless it keeps dying on startup (broken install/auth), which must back off, not hot-loop every ~15s.
        if (result.Outcome == PilotWaitOutcome.SessionExited)
        {
            ConsecutiveSessionExits++;
            if (ConsecutiveSessionExits >= BackoffThreshold)
            {
                await ReportAsync(ExitBackoffReport);
                await env.SleepAsync(BackoffDelay, ct);
                ConsecutiveSessionExits = 0;
            }
            return true;
        }

        if (result.Outcome != PilotWaitOutcome.Sentinel)
        {
            return false; // Timeout or a stall heuristic fired: ask the user.
        }

        ConsecutiveTimeouts = 0;
        ConsecutiveSessionExits = 0;
        LastCycleAt = DateTimeOffset.UtcNow;
        LastCycleStatus = result.Cycle.Status;
        await env.SleepAsync(TimeSpan.FromSeconds(ClampSleep(result.Cycle.SleepSeconds)), ct);
        return true;
    }

    // Owns one cycle's wait-budget accounting and the once-per-cycle extend journal. A class, not a struct: its
    // async methods mutate these fields across awaits, which a struct would lose to state-machine copies.
    private sealed class CycleWait(PilotLoop loop, CancellationToken ct)
    {
        private TimeSpan totalWaited;
        private bool extended;

        // Awaits one sentinel window and books it against the cycle's hard cap.
        public async Task<PilotWaitResult> AwaitAsync(TimeSpan window)
        {
            var result = await loop.env.AwaitSentinelAsync(window, ct);
            totalWaited += window;
            return result;
        }

        // Re-awaits while the wedge coincides with fresh server activity and the cycle stays under MaxCycleWait,
        // journaling the extension once; returns once the cycle finishes, activity goes stale, or the cap is hit.
        public async Task<PilotWaitResult> ExtendWhileLiveAsync(PilotWaitResult current)
        {
            while (IsWedge(current) && totalWaited < MaxCycleWait && await loop.IsActivityFreshAsync(ct))
            {
                if (!extended)
                {
                    await loop.ReportAsync(ExtendReport);
                    extended = true;
                }

                current = await AwaitAsync(SentinelTimeout);
            }

            return current;
        }
    }
}

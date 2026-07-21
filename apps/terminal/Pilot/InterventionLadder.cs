namespace JobPilot.Terminal.Pilot;

/// <summary>How a cycle wait resolved: finished (stop, honoring <see cref="Sleep"/>) or unresolved (climb the ladder).</summary>
internal readonly record struct CycleResolution(bool Finished, TimeSpan? Sleep)
{
    /// <summary>The wait did not finish the cycle; the ladder should climb the next rung.</summary>
    public static readonly CycleResolution Climb = new(false, null);

    /// <summary>The cycle finished with nothing to wait out; loop immediately (restarted, exited, or backed off).</summary>
    public static readonly CycleResolution LoopNow = new(true, null);

    /// <summary>The cycle completed; wait out the inter-cycle sleep before the next one.</summary>
    public static CycleResolution SleepFor(TimeSpan sleep) => new(true, sleep);
}

/// <summary>
/// Recovers a stuck cycle by climbing check-in -> skip -> restart, guarding each rung with a completion probe so a
/// server-confirmed finish ends the cycle instead of intervening. Owns the consecutive-restart backoff counter; the
/// runner supplies <paramref name="finish"/> to interpret each wait result and <paramref name="report"/> to journal.
/// </summary>
internal sealed class InterventionLadder(
    IPilotRuntime env,
    Func<PilotWaitResult, CancellationToken, Task<CycleResolution>> finish,
    Func<string, CancellationToken, Task> report)
{
    /// <summary>Consecutive restarts; reset by any completed cycle so a healthy run clears the backoff.</summary>
    public int ConsecutiveRestarts { get; private set; }

    public void Reset() => ConsecutiveRestarts = 0;

    /// <summary>Climbs the ladder for a stuck cycle, returning how it resolved.</summary>
    public async Task<CycleResolution> ClimbAsync(PilotPairing pairing, CycleWaiter waiter, CancellationToken ct)
    {
        // Rungs 1-2: check in once, then force the claimed task failed so the next cycle can move on. Each rung
        // first honors a completion that just landed, then allows a shorter grace before escalating.
        (string Report, Func<PilotPairing, CancellationToken, Task> Inject)[] rungs =
        [
            (PilotReports.CheckIn, env.InjectCheckInAsync),
            (PilotReports.Skip, env.InjectSkipAsync),
        ];

        foreach (var (summary, inject) in rungs)
        {
            if (await GuardAsync(waiter, ct) is { Finished: true } guarded)
            {
                return guarded;
            }
            await report(summary, ct);
            await inject(pairing, ct);
            var resolution = await finish(await waiter.WaitAsync(PilotCycleRunner.CheckInGrace, ct), ct);
            if (resolution.Finished)
            {
                return resolution;
            }
        }

        // Rung 3: still stuck - restart for a clean session, and back off once repeated restarts prove the install is broken.
        if (await GuardAsync(waiter, ct) is { Finished: true } guard)
        {
            return guard;
        }
        ConsecutiveRestarts++;
        await report(PilotReports.Restart, ct);
        env.StopSession();
        if (ConsecutiveRestarts >= PilotCycleRunner.BackoffThreshold)
        {
            await report(PilotReports.Backoff, ct);
            await env.SleepAsync(PilotCycleRunner.BackoffDelay, ct);
        }
        return CycleResolution.LoopNow;
    }

    private async Task<CycleResolution> GuardAsync(CycleWaiter waiter, CancellationToken ct)
    {
        if (await waiter.PollCompletionAsync(ct) is { } cycle)
        {
            return await finish(PilotWaitResult.Sentinel(cycle), ct);
        }

        return CycleResolution.Climb;
    }
}

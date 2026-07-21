namespace JobPilot.Terminal.Pilot;

/// <summary>
/// Waits for the next cycle sentinel in short slices. After each lapse it consults one server snapshot: a completion
/// the TUI garbled ends the wait immediately, and fresh activity defers the intervention ladder (up to a whole-cycle
/// cap) so a slow but live run is never interrupted. Booking is cumulative across a cycle's waits, so one instance
/// serves the initial wait and each post-intervention grace and the cap covers the whole cycle.
/// </summary>
internal sealed class CycleWaiter(
    IPilotRuntime env,
    CompletionTracker completion,
    TimeSpan pollInterval,
    Func<CancellationToken, Task<PilotActivitySnapshot?>> probe,
    Func<string, CancellationToken, Task> report)
{
    private TimeSpan totalWaited;
    private bool extended;

    /// <summary>
    /// Waits for the sentinel, surrendering to the ladder only after the run has stayed quiet for a full budget with
    /// no completion, or the whole-cycle cap is reached. Returns the sentinel/exit/timeout/stuck the ladder acts on.
    /// </summary>
    public async Task<PilotWaitResult> WaitAsync(TimeSpan quietBudget, CancellationToken ct)
    {
        var slice = pollInterval < quietBudget ? pollInterval : quietBudget;
        var quiet = TimeSpan.Zero;

        while (true)
        {
            var result = await env.AwaitSentinelAsync(slice, ct);
            if (result.Outcome is PilotWaitOutcome.Sentinel or PilotWaitOutcome.SessionExited)
            {
                return result;
            }

            // A stuck heuristic returns the moment it fires; booking that as elapsed would let one noisy
            // burst spend the whole cycle budget in seconds.
            if (result.Outcome is PilotWaitOutcome.Timeout)
            {
                totalWaited += slice;
                quiet += slice;
            }

            var snapshot = await probe(ct);
            if (completion.TryAdvance(snapshot) is { } cycle)
            {
                await report(PilotReports.Completion, ct);
                return PilotWaitResult.Sentinel(cycle);
            }

            if (IsFresh(snapshot))
            {
                if (totalWaited >= PilotCycleRunner.MaxCycleWait)
                {
                    return result; // Alive but the cycle has run too long overall; let the ladder take over.
                }

                if (totalWaited >= PilotCycleRunner.SentinelTimeout && !extended)
                {
                    await report(PilotReports.Extend, ct); // Running past the usual window but still making progress.
                    extended = true;
                }

                quiet = TimeSpan.Zero; // Proof of life resets the quiet budget.
            }
            else if (quiet >= quietBudget || result.Outcome is PilotWaitOutcome.StuckDetected)
            {
                // No proof of life: a fired stuck heuristic escalates now, a plain timeout after a full quiet budget.
                return result;
            }
        }
    }

    /// <summary>Probes once for a completion the TUI may have garbled, for use right before a ladder rung intervenes.</summary>
    public async Task<PilotCycle?> PollCompletionAsync(CancellationToken ct)
    {
        var cycle = completion.TryAdvance(await probe(ct));
        if (cycle is not null)
        {
            await report(PilotReports.Completion, ct);
        }

        return cycle;
    }

    private static bool IsFresh(PilotActivitySnapshot? snapshot) =>
        snapshot is { LastActivityAt: { } at } && DateTimeOffset.UtcNow - at < PilotCycleRunner.LivenessWindow;
}

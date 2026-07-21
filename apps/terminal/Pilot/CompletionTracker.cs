namespace JobPilot.Terminal.Pilot;

/// <summary>
/// Tracks the newest server-recorded cycle completion so a garbled sentinel can still be recognized as a finished
/// cycle. Pure: the caller supplies each activity snapshot, so the advance rule compares server values only and
/// never a server time against a host time.
/// </summary>
internal sealed class CompletionTracker
{
    private PilotCompletedCycle? baseline;
    private bool armed;

    /// <summary>
    /// Memoizes the server's current completion as the baseline before a cycle injects. A failed probe (null
    /// snapshot) with no prior baseline disarms the tracker for the cycle, so only the sentinel can end it.
    /// </summary>
    public void Prime(PilotActivitySnapshot? snapshot)
    {
        if (snapshot is { } snap)
        {
            baseline = snap.LastCycle;
            armed = true;
        }
        else
        {
            armed = baseline is not null;
        }
    }

    /// <summary>Returns a synthesized cycle when the snapshot shows a completion newer than the baseline; null otherwise.</summary>
    public PilotCycle? TryAdvance(PilotActivitySnapshot? snapshot)
    {
        if (!armed || snapshot is not { LastCycle: { } current } || !IsNewer(current))
        {
            return null;
        }

        baseline = current;
        return Synthesize(current);
    }

    /// <summary>On resume, primes from a fresh snapshot and returns any still-owed inter-cycle sleep (floored at zero).</summary>
    public TimeSpan PrimeResume(PilotActivitySnapshot? snapshot)
    {
        Prime(snapshot);
        if (snapshot is not { LastCycle: { } last })
        {
            return TimeSpan.Zero;
        }

        // A completion with no sleep hint is a skill bug; treat it as the minimum so resume owes at most a brief wait.
        var planned = TimeSpan.FromSeconds(PilotCycleRunner.ClampSleep(last.SleepSeconds ?? PilotCycleRunner.MinSleepSeconds));
        var remaining = planned - (DateTimeOffset.UtcNow - last.CompletedAt);
        if (remaining <= TimeSpan.Zero)
        {
            return TimeSpan.Zero;
        }

        return remaining > planned ? planned : remaining;
    }

    private bool IsNewer(PilotCompletedCycle current)
    {
        if (baseline is not { } prior)
        {
            return true; // Nothing recorded before this cycle; any completion is new.
        }

        return !string.Equals(current.CycleId, prior.CycleId, StringComparison.Ordinal)
            || current.CompletedAt > prior.CompletedAt;
    }

    private static PilotCycle Synthesize(PilotCompletedCycle completed)
    {
        var id = Guid.TryParse(completed.CycleId, out var parsed) ? parsed : Guid.Empty;
        var status = completed.Status switch
        {
            "empty" => PilotCycleStatus.Empty,
            "error" => PilotCycleStatus.Error,
            _ => PilotCycleStatus.Ok,
        };
        // A completion with no sleep hint is a skill bug; fall back to the minimum clamp so the next cycle runs soon.
        return new PilotCycle(id, status, completed.SleepSeconds ?? PilotCycleRunner.MinSleepSeconds);
    }
}

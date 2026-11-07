using JobPilot.Terminal.Common;
using JobPilot.Terminal.Pilot.Api;

namespace JobPilot.Terminal.Pilot;

/// <summary>Runs cycles whenever the host is paired and parks while it is not.</summary>
public sealed class PilotLoop : BackgroundService
{
    private static readonly TimeSpan ErrorBackoff = TimeSpan.FromSeconds(30);

    // Lets Kestrel finish binding before a restarted host resumes its first cycle.
    private static readonly TimeSpan StartupResumeDelay = TimeSpan.FromSeconds(10);

    private readonly PairingStore store;
    private readonly IPilotAgent agent;
    private readonly IPilotApi api;
    private readonly TimeProvider time;
    private readonly ILogger<PilotLoop> logger;
    private readonly CycleRunner runner;

    private readonly WakeSignal wakeSignal;

    private readonly Lock sync = new();
    private CancellationTokenSource? cycleCts;

    // With no reachable API a cycle is pure burn, so the loop backs off instead.
    private ExponentialBackoff apiBackoff = new(TimeSpan.FromSeconds(30), TimeSpan.FromMinutes(10));
    private volatile bool working;

    public PilotLoop(PairingStore store, IPilotAgent agent, IPilotApi api, TimeProvider time, WakeSignal wakeSignal, ILogger<PilotLoop> logger)
    {
        this.store = store;
        this.agent = agent;
        this.api = api;
        this.time = time;
        this.wakeSignal = wakeSignal;
        this.logger = logger;
        runner = new CycleRunner(agent, api, time);
        store.Changed += Wake;
    }

    /// <summary>Ends an inter-cycle sleep early. If the host was unpaired, also aborts the live cycle.</summary>
    public void Wake()
    {
        wakeSignal.Signal();
        lock (sync)
        {
            // A wake that leaves the host paired must never interrupt the agent mid-turn.
            if (store.Current is null)
            {
                cycleCts?.Cancel();
            }
        }
    }

    public PilotStatus GetStatus()
    {
        var pairing = store.Current;
        return new PilotStatus
        {
            Paired = pairing is not null,
            UserId = pairing?.UserId,
            Conducting = working && runner.Conducting,
            HeldUntil = runner.HeldUntil(time.GetUtcNow()),
            LastCycleAt = runner.LastCycleAt,
            LastCycleStatus = runner.LastCycleStatus?.ToString().ToLowerInvariant(),
        };
    }

    public override void Dispose()
    {
        store.Changed -= Wake;
        lock (sync)
        {
            cycleCts?.Dispose();
        }

        base.Dispose();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await ResumeIfPairedAsync(stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            CancellationTokenSource cycle;
            lock (sync)
            {
                cycleCts?.Dispose();
                cycle = cycleCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            }

            working = false;

            // Read only after publishing the token: an unpair then either cancels this token or shows up in this read.
            var pairing = store.Current;
            try
            {
                if (pairing is null)
                {
                    await wakeSignal.TakeAsync(stoppingToken);
                    continue;
                }

                await RunOnceAsync(pairing, cycle.Token, stoppingToken);
            }
            catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
            {
                // An unpair aborts the agent's turn, unless it is the user's own session on the other provider.
                if (runner.Conducting && store.Current is null)
                {
                    agent.AbortTurn();
                }
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Pilot cycle failed; backing off before retrying.");
                working = false;
                try
                {
                    await Task.Delay(ErrorBackoff, time, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }
    }

    private async Task RunOnceAsync(PilotPairing pairing, CancellationToken ct, CancellationToken stoppingToken)
    {
        // One probe checks the API is reachable before the cycle spends a refresh.
        var activity = await api.GetActivityAsync(ct);
        if (activity is null)
        {
            await SleepOrWakeAsync(apiBackoff.Next(), ct);
            return;
        }

        apiBackoff.Reset();

        // This cycle reads the current pairing, which covers any wake that came before it.
        wakeSignal.TryTake();

        working = true;
        var sleep = await runner.RunAsync(pairing, ct);
        if (sleep is { } duration && duration > TimeSpan.Zero)
        {
            await SleepOrWakeAsync(duration, ct);
        }
    }

    private async Task ResumeIfPairedAsync(CancellationToken stoppingToken)
    {
        if (store.Current is null)
        {
            return;
        }

        await Task.Delay(StartupResumeDelay, time, stoppingToken);
        var owed = CycleSleep.RemainingSleep(await api.GetActivityAsync(stoppingToken), time.GetUtcNow());
        if (owed <= TimeSpan.Zero)
        {
            await api.WriteJournalAsync(JournalLines.Resume, stoppingToken);
            return;
        }

        await api.WriteJournalAsync($"{JournalLines.Resume} Waiting out the planned break until {time.GetUtcNow() + owed:u} first.", stoppingToken);
        await SleepOrWakeAsync(owed, stoppingToken);
    }

    /// <summary>Sleeps until the duration passes or a wake arrives. Throws when <paramref name="ct"/> cancels.</summary>
    private async Task SleepOrWakeAsync(TimeSpan duration, CancellationToken ct)
    {
        // A wake during the cycle had no sleep to end, so its pending wake ends this one before it starts.
        if (wakeSignal.TryTake())
        {
            return;
        }

        using var sleepCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var woken = wakeSignal.WaitAsync(sleepCts.Token);
        var slept = Task.Delay(duration, time, sleepCts.Token);
        await Task.WhenAny(woken, slept);
        await sleepCts.CancelAsync();
        ct.ThrowIfCancellationRequested();
    }
}

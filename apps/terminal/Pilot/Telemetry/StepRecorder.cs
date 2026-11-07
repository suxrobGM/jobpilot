using System.Text.Json;
using JobPilot.Terminal.Pilot.Api;

namespace JobPilot.Terminal.Pilot.Telemetry;

/// <summary>Collects the run's tool calls from the CLI's log export and posts them as steps every 2 seconds.</summary>
public sealed class StepRecorder(IPilotApi api) : BackgroundService
{
    private const int MaxBatch = 100;
    private static readonly TimeSpan FlushEvery = TimeSpan.FromSeconds(2);

    private readonly Lock sync = new();
    private readonly List<PilotStep> pending = [];
    private string? runId;

    /// <summary>Only tool calls after this belong to the run; the user's own session between runs never leaves the machine.</summary>
    public void Start(string run)
    {
        lock (sync)
        {
            runId = run;
            pending.Clear();
        }
    }

    /// <summary>Steps after the result are dropped: the run is closed and the API would refuse them.</summary>
    public void Stop()
    {
        lock (sync)
        {
            runId = null;
            pending.Clear();
        }
    }

    public void Read(JsonElement export)
    {
        foreach (var attributes in OtlpLogs.Records(export))
        {
            if (StepMapper.FromRecord(attributes) is not { } call || StepMapper.Label(call) is not { } label)
            {
                continue;
            }

            lock (sync)
            {
                if (runId is not null)
                {
                    pending.Add(new PilotStep(DateTimeOffset.UtcNow, label));
                }
            }
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(FlushEvery);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await FlushAsync(stoppingToken);
        }
    }

    private async Task FlushAsync(CancellationToken ct)
    {
        string? run;
        PilotStep[] batch;
        lock (sync)
        {
            run = runId;
            batch = [.. pending.TakeLast(MaxBatch)];
            pending.Clear();
        }

        if (run is not null && batch.Length > 0)
        {
            await api.PostStepsAsync(run, batch, ct);
        }
    }
}

using System.Net.ServerSentEvents;
using System.Text.Json;
using JobPilot.Terminal.Common;

namespace JobPilot.Terminal.Pilot;

/// <summary>The event type is in the JSON, not the SSE event name.</summary>
internal sealed record PilotEvent(string? Type, string? RunId = null, string? Outcome = null, string? Text = null);

/// <summary>What the listener hands on: a wake, a finished run, and the user's interrupt or steer of a run.</summary>
public sealed record PilotEventHandlers(
    Action Wake,
    Action<string, string> RunFinished,
    Func<string, CancellationToken, Task> Interrupt,
    Func<string, string, CancellationToken, Task> Steer);

/// <summary>
/// Holds the pilot event stream open while the host is paired. It wakes the loop on work the user asked for, passes
/// each finished run to the session waiting on it, and relays interrupts and steers of the run in flight.
/// </summary>
public sealed class PilotEventListener(
    PilotStore store, PilotApi api, PilotEventHandlers handlers, ILogger<PilotEventListener> logger)
    : BackgroundService
{
    private static readonly TimeSpan InitialBackoff = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan MaxBackoff = TimeSpan.FromMinutes(5);

    internal static bool ShouldWake(PilotEvent e) => e.Type switch
    {
        "question.answered" or "state.changed" or "message.created" or "request.created" or "job.approved" => true,
        _ => false,
    };

    internal static PilotEvent? Parse(string data)
    {
        // Control frames (connected, ping) carry no data.
        if (string.IsNullOrEmpty(data))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize(data, AppJsonContext.Default.PilotEvent);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var backoff = new ExponentialBackoff(InitialBackoff, MaxBackoff);
        while (!stoppingToken.IsCancellationRequested)
        {
            // Any settings change cancels this pass, so the stream never outlives the credentials it opened with.
            using var changed = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            void OnChanged() => changed.Cancel();
            store.Changed += OnChanged;
            try
            {
                // Read after subscribing, so a change in between still cancels this pass.
                if (store.Current is not { } settings)
                {
                    await Task.Delay(Timeout.Infinite, changed.Token);
                    continue;
                }

                var connected = await StreamAsync(settings, changed.Token);
                if (connected)
                {
                    backoff.Reset();
                }

                await Task.Delay(connected ? InitialBackoff : backoff.Next(), changed.Token);
            }
            catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
            {
                backoff.Reset();
            }
            catch (OperationCanceledException)
            {
                return;
            }
            finally
            {
                store.Changed -= OnChanged;
            }
        }
    }

    /// <summary>Pumps events until the stream ends. Returns whether the server accepted the connection.</summary>
    private async Task<bool> StreamAsync(PilotSettings settings, CancellationToken ct)
    {
        var connected = false;
        try
        {
            using var response = await api.OpenEventsAsync(settings, ct);
            if (response is null)
            {
                return false;
            }

            connected = true;
            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            await foreach (var item in SseParser.Create(stream).EnumerateAsync(ct))
            {
                await HandleAsync(item.Data, ct);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogDebug(ex, "Pilot event stream dropped; will reconnect.");
        }

        return connected;
    }

    private async Task HandleAsync(string data, CancellationToken ct)
    {
        if (Parse(data) is not { } e)
        {
            return;
        }

        switch (e)
        {
            case { Type: "run.finished", RunId: { } runId }:
                handlers.RunFinished(runId, e.Outcome ?? "failed");
                break;
            case { Type: "run.interrupt", RunId: { } runId }:
                await handlers.Interrupt(runId, ct);
                break;
            case { Type: "run.steer", RunId: { } runId, Text: { } text }:
                await handlers.Steer(runId, text, ct);
                break;
        }

        if (ShouldWake(e))
        {
            handlers.Wake();
        }
    }
}

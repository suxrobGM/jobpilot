using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using JobPilot.Terminal.Common;
using Microsoft.Extensions.Hosting;

namespace JobPilot.Terminal.Pilot;

/// <summary>Minimal shape of a pilot SSE event payload; only the fields the wake decision needs are read.</summary>
internal sealed record PilotSseEnvelope
{
    public string? Type { get; init; }
    public PilotSsePromotion? Promotion { get; init; }
    public PilotSseState? State { get; init; }
}

/// <summary>The promotion status carried by a <c>promotion.updated</c> event.</summary>
internal sealed record PilotSsePromotion
{
    public string? Status { get; init; }
}

/// <summary>The pilot state carried by a <c>state.changed</c> event; only the running flag matters here.</summary>
internal sealed record PilotSseState
{
    public bool? Running { get; init; }
}

/// <summary>
/// Long-lived listener on the API's pilot SSE feed. While the pilot is running+paired it holds a streaming
/// connection and wakes the coordinator the moment a question is answered, an approved promotion lands, or
/// state changes - so a sleeping coordinator starts its next cycle within seconds instead of at nextWakeAt.
/// Reconnects with exponential backoff, tears down when stopped, and never faults the host.
/// </summary>
public sealed class PilotEventListener : BackgroundService
{
    // While disconnected the pairing is re-polled at this cadence to notice an enable without a wake signal.
    private static readonly TimeSpan IdlePoll = TimeSpan.FromSeconds(2);

    internal static readonly TimeSpan InitialBackoff = TimeSpan.FromSeconds(5);
    internal static readonly TimeSpan MaxBackoff = TimeSpan.FromMinutes(5);

    private readonly PilotStore store;
    private readonly PilotCoordinator coordinator;
    private readonly ILogger<PilotEventListener> logger;
    private readonly HttpClient http;

    public PilotEventListener(PilotStore store, PilotCoordinator coordinator, ILogger<PilotEventListener> logger)
        // The SSE stream is intentionally long-lived, so it must never be bounded by a client timeout.
        : this(store, coordinator, logger, HttpClients.CreateLongLivedClient())
    {
    }

    /// <summary>Test seam: inject the client (and its message handler) that backs the stream.</summary>
    internal PilotEventListener(PilotStore store, PilotCoordinator coordinator, ILogger<PilotEventListener> logger, HttpClient http)
    {
        this.store = store;
        this.coordinator = coordinator;
        this.logger = logger;
        this.http = http;
    }

    /// <summary>True when a stored, running pairing with an API URL can be streamed from.</summary>
    internal static bool ShouldConnect(PilotPairing? pairing) =>
        pairing is { Running: true } && !string.IsNullOrWhiteSpace(pairing.ApiUrl);

    /// <summary>Whether a parsed frame is a wake-worthy pilot event. Pure so the dispatch table is unit-testable.</summary>
    internal static bool ShouldWake(SseFrame frame)
    {
        var envelope = TryParseEnvelope(frame);
        if (envelope is null)
        {
            return false;
        }

        // The wire puts the domain type in the JSON payload; fall back to the SSE event name if a server ever names it.
        var type = envelope.Type ?? frame.Event;
        return type switch
        {
            "question.answered" => true,
            "state.changed" => true,
            "promotion.updated" => string.Equals(envelope.Promotion?.Status, "approved", StringComparison.Ordinal),
            _ => false,
        };
    }

    /// <summary>
    /// Whether a frame is an API-side stop that must sync to the local store. Pure so it is unit-testable.
    /// Only a stop can sync here: the listener itself only streams while the local store is running.
    /// </summary>
    internal static bool IsRemoteStop(SseFrame frame)
    {
        var envelope = TryParseEnvelope(frame);
        return (envelope?.Type ?? frame.Event) == "state.changed" && envelope?.State?.Running == false;
    }

    private static PilotSseEnvelope? TryParseEnvelope(SseFrame frame)
    {
        // Control frames (connected/ping) carry a name but no data; only domain events carry a payload.
        if (string.IsNullOrEmpty(frame.Data))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize(frame.Data, AppJsonContext.Default.PilotSseEnvelope);
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
            var pairing = store.Current;
            if (!ShouldConnect(pairing))
            {
                await QuietDelayAsync(IdlePoll, stoppingToken);
                continue;
            }

            var streamed = false;
            try
            {
                streamed = await StreamAsync(pairing!, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return; // host shutting down
            }
            catch (Exception ex)
            {
                logger.LogDebug(ex, "Pilot event stream dropped; will reconnect.");
            }
            // A changed pairing reconnects immediately after the heartbeat that exposed it; transport drops back off.
            var current = store.Current;
            if (!ShouldConnect(current) || current != pairing)
            {
                backoff.Reset();
            }
            else if (streamed)
            {
                backoff.Reset();
                await QuietDelayAsync(InitialBackoff, stoppingToken);
            }
            else
            {
                await QuietDelayAsync(backoff.Next(), stoppingToken);
            }
        }
    }

    /// <summary>Opens the stream and pumps frames until it drops or the pilot is disabled. Returns whether any data arrived.</summary>
    private async Task<bool> StreamAsync(PilotPairing pairing, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{pairing.ApiUrl.TrimEnd('/')}/api/pilot/events");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", pairing.ApiToken);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));

        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Pilot event stream was rejected ({Status}).", (int)response.StatusCode);
            return false;
        }

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var reader = new StreamReader(stream, Encoding.UTF8);
        var parser = new SseParser();
        var buffer = new char[4096];
        var gotData = false;

        while (!ct.IsCancellationRequested)
        {
            var read = await reader.ReadAsync(buffer, ct);
            if (read == 0)
            {
                break; // server closed the stream
            }

            gotData = true;
            foreach (var frame in parser.Feed(new ReadOnlySpan<char>(buffer, 0, read)))
            {
                // A stop from another device can't reach this host directly; mirror it into the local store
                // before waking, or the coordinator re-reads Running=true and keeps spawning sessions forever.
                if (IsRemoteStop(frame))
                {
                    store.SetRunning(false);
                }

                if (ShouldWake(frame))
                {
                    coordinator.WakeUp();
                }
            }

            // Pairing changes are heartbeat-bounded so this stream never keeps using stale credentials indefinitely.
            if (store.Current != pairing)
            {
                break;
            }
        }

        return gotData;
    }

    private static async Task QuietDelayAsync(TimeSpan delay, CancellationToken ct)
    {
        try
        {
            await Task.Delay(delay, ct);
        }
        catch (OperationCanceledException)
        {
            // Shutdown; the loop condition re-checks the token and exits.
        }
    }

    public override void Dispose()
    {
        http.Dispose();
        base.Dispose();
    }
}

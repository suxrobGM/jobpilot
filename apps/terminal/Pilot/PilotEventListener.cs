using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;

namespace JobPilot.Terminal.Pilot;

/// <summary>Minimal shape of a pilot SSE event payload; only the fields the wake decision needs are read.</summary>
internal sealed record PilotSseEnvelope
{
    public string? Type { get; init; }
    public PilotSsePromotion? Promotion { get; init; }
}

/// <summary>The promotion status carried by a <c>promotion.updated</c> event.</summary>
internal sealed record PilotSsePromotion
{
    public string? Status { get; init; }
}

/// <summary>
/// Long-lived listener on the API's pilot SSE feed. While the pilot is enabled+paired it holds a streaming
/// connection and wakes the conductor the moment an escalation is answered, an approved promotion lands, or
/// state changes — so a sleeping conductor starts its next cycle within seconds instead of at nextWakeAt.
/// Reconnects with exponential backoff, tears down when disabled, and never faults the host.
/// </summary>
public sealed class PilotEventListener : BackgroundService, IDisposable
{
    // While disconnected the pairing is re-polled at this cadence to notice an enable without a wake signal.
    private static readonly TimeSpan IdlePoll = TimeSpan.FromSeconds(2);

    internal static readonly TimeSpan InitialBackoff = TimeSpan.FromSeconds(5);
    internal static readonly TimeSpan MaxBackoff = TimeSpan.FromMinutes(5);

    private readonly PilotStore store;
    private readonly PilotConductor conductor;
    private readonly ILogger<PilotEventListener> logger;
    private readonly HttpClient http;

    /// <summary>Whether the event stream is currently connected. Surfaced on /healthz via the conductor.</summary>
    public bool Connected { get; private set; }

    public PilotEventListener(PilotStore store, PilotConductor conductor, ILogger<PilotEventListener> logger)
        // The SSE stream is intentionally long-lived, so it must never be bounded by a client timeout.
        : this(store, conductor, logger, PilotHttp.CreateLongLivedClient())
    {
    }

    /// <summary>Test seam: inject the client (and its message handler) that backs the stream.</summary>
    internal PilotEventListener(PilotStore store, PilotConductor conductor, ILogger<PilotEventListener> logger, HttpClient http)
    {
        this.store = store;
        this.conductor = conductor;
        this.logger = logger;
        this.http = http;
    }

    /// <summary>True when a stored, enabled pairing with an API URL can be streamed from.</summary>
    internal static bool ShouldConnect(PilotPairing? pairing) =>
        pairing is { Enabled: true } && !string.IsNullOrWhiteSpace(pairing.ApiUrl);

    /// <summary>Whether a parsed frame is a wake-worthy pilot event. Pure so the dispatch table is unit-testable.</summary>
    internal static bool ShouldWake(SseFrame frame)
    {
        // Control frames (connected/ping) carry a name but no data; only domain events wake the conductor.
        if (string.IsNullOrEmpty(frame.Data))
        {
            return false;
        }

        PilotSseEnvelope? envelope;
        try
        {
            envelope = JsonSerializer.Deserialize(frame.Data, AppJsonContext.Default.PilotSseEnvelope);
        }
        catch (JsonException)
        {
            return false;
        }

        // The wire puts the domain type in the JSON payload; fall back to the SSE event name if a server ever names it.
        var type = envelope?.Type ?? frame.Event;
        return type switch
        {
            "escalation.answered" => true,
            "state.changed" => true,
            "promotion.updated" => string.Equals(envelope?.Promotion?.Status, "approved", StringComparison.Ordinal),
            _ => false,
        };
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var backoff = new SseBackoff();

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
            finally
            {
                SetConnected(false);
            }

            // A stream that carried data resets backoff; a disable ends cleanly, so only a real drop escalates it.
            if (!ShouldConnect(store.Current))
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
        request.Headers.TryAddWithoutValidation("authorization", $"Bearer {pairing.ApiToken}");
        request.Headers.TryAddWithoutValidation("accept", "text/event-stream");

        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Pilot event stream was rejected ({Status}).", (int)response.StatusCode);
            return false;
        }

        SetConnected(true);
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
                if (ShouldWake(frame))
                {
                    conductor.WakeUp();
                }
            }

            // Tear down promptly once disabled; the broker's ~15s heartbeat guarantees this re-check runs.
            if (!ShouldConnect(store.Current))
            {
                break;
            }
        }

        return gotData;
    }

    private void SetConnected(bool value)
    {
        if (Connected == value)
        {
            return;
        }

        Connected = value;
        conductor.SetEventStreamConnected(value);
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

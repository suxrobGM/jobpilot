using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using JobPilot.Terminal.Common;

namespace JobPilot.Terminal.Pilot;

/// <summary>Body of a POST /api/pilot/journal request.</summary>
internal sealed record PilotJournalRequest(PilotJournalEntry[] Entries);

/// <summary>One journal entry; the host only ever writes <c>kind=system</c>.</summary>
internal sealed record PilotJournalEntry(string Kind, string Summary);

/// <summary>Body of a GET /api/pilot/activity response; carries the run-state the pre-inject gate reads.</summary>
internal sealed record PilotActivityResponse(bool Running, DateTimeOffset? LastActivityAt, PilotLastCycleResponse? LastCycle);

/// <summary>The newest server-recorded cycle completion, or null when the user has no completed cycle yet.</summary>
internal sealed record PilotLastCycleResponse(string? CycleId, DateTimeOffset CompletedAt, string? Status, int? SleepSeconds);

/// <summary>
/// Posts the coordinator's own interventions to the API journal so the user's phone hears about them.
/// Best-effort: a briefly unreachable API logs a warning and never throws into the coordinator loop.
/// </summary>
public sealed class PilotApiClient : IDisposable
{
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(10);

    private readonly HttpClient http;
    private readonly ILogger<PilotApiClient> logger;

    public PilotApiClient(ILogger<PilotApiClient> logger)
        : this(logger, HttpClients.CreateLongLivedClient())
    {
    }

    /// <summary>Test seam: inject the message handler that backs the client.</summary>
    internal PilotApiClient(ILogger<PilotApiClient> logger, HttpClient http)
    {
        this.logger = logger;
        this.http = http;
    }

    /// <summary>Reports a system-journal entry to the paired API. Never throws.</summary>
    public async Task ReportSystemAsync(
        string apiUrl,
        string apiToken,
        string summary,
        CancellationToken ct = default)
    {
        try
        {
            var body = new PilotJournalRequest([new PilotJournalEntry("system", summary)]);
            var json = JsonSerializer.Serialize(body, AppJsonContext.Default.PilotJournalRequest);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            await SendGuardedAsync<bool>(apiUrl, apiToken, HttpMethod.Post, "/api/pilot/journal", content,
                "Pilot journal report was rejected ({Status}).", static (_, _) => Task.FromResult<bool>(default), ct);
        }
        catch (Exception ex) when (
            ex is HttpRequestException or OperationCanceledException && !Cancellation.IsCallerCancellation(ex, ct))
        {
            logger.LogWarning(ex, "Pilot journal report could not be delivered.");
        }
    }

    /// <summary>
    /// Probes the API for the newest agent activity, gating the orchestrator ladder and the sentinel-loss completion
    /// fallback. Never throws: any failure returns null so the caller falls open to the timeout behavior instead
    /// of blocking a cycle. A struct-valued result (even with all-null fields) still means the probe succeeded.
    /// </summary>
    public async Task<PilotActivitySnapshot?> GetActivityAsync(string apiUrl, string apiToken, CancellationToken ct = default)
    {
        try
        {
            return await SendGuardedAsync<PilotActivitySnapshot?>(apiUrl, apiToken, HttpMethod.Get, "/api/pilot/activity",
                content: null, "Pilot activity probe was rejected ({Status}).", async (response, token) =>
                {
                    var json = await response.Content.ReadAsStringAsync(token);
                    var activity = JsonSerializer.Deserialize(json, AppJsonContext.Default.PilotActivityResponse);
                    if (activity is null)
                    {
                        return null;
                    }

                    var last = activity.LastCycle is { } c
                        ? new PilotCompletedCycle(c.CycleId, c.CompletedAt, c.Status, c.SleepSeconds)
                        : (PilotCompletedCycle?)null;
                    return new PilotActivitySnapshot(activity.LastActivityAt, last);
                }, ct);
        }
        catch (Exception ex) when (!Cancellation.IsCallerCancellation(ex, ct))
        {
            // Fail-open on anything (transport, timeout, malformed body): the orchestrator then uses its heuristics alone.
            logger.LogWarning(ex, "Pilot activity probe could not be delivered.");
            return null;
        }
    }

    /// <summary>
    /// The server's pilot run-state, read off the activity probe: GET /api/pilot would upsert a PilotState row and
    /// serialize the whole DTO on every gate check. Never throws: null on any failure, so the caller backs off
    /// instead of injecting.
    /// </summary>
    public async Task<bool?> GetRunningAsync(string apiUrl, string apiToken, CancellationToken ct = default)
    {
        try
        {
            return await SendGuardedAsync<bool?>(apiUrl, apiToken, HttpMethod.Get, "/api/pilot/activity",
                content: null, "Pilot run-state probe was rejected ({Status}).", async (response, token) =>
                {
                    var json = await response.Content.ReadAsStringAsync(token);
                    var activity = JsonSerializer.Deserialize(json, AppJsonContext.Default.PilotActivityResponse);
                    return activity is null ? null : activity.Running;
                }, ct);
        }
        catch (Exception ex) when (!Cancellation.IsCallerCancellation(ex, ct))
        {
            // Fail-open on anything (transport, timeout, malformed body): the coordinator backs off instead of injecting.
            logger.LogWarning(ex, "Pilot run-state probe could not be delivered.");
            return null;
        }
    }

    /// <summary>
    /// Shared scaffolding for the best-effort calls: unpaired guard, request timeout, base-URL join, Bearer
    /// header, and the non-success warning. Returns <c>default</c> when unpaired or rejected; otherwise the result
    /// of <paramref name="onSuccess"/>, run while the response and its timeout token are still alive. Transport and
    /// timeout exceptions propagate to the caller's own catch so each keeps its distinct failure log.
    /// </summary>
    private async Task<T?> SendGuardedAsync<T>(
        string apiUrl,
        string apiToken,
        HttpMethod method,
        string path,
        HttpContent? content,
        string rejectedLog,
        Func<HttpResponseMessage, CancellationToken, Task<T?>> onSuccess,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(apiUrl) || string.IsNullOrWhiteSpace(apiToken))
        {
            return default; // Unpaired or a legacy pairing with no API URL; no channel to consult.
        }

        // Linked so a cancelled coordinator aborts the probe instead of waiting out the request timeout.
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(RequestTimeout);
        using var request = new HttpRequestMessage(method, $"{apiUrl.TrimEnd('/')}{path}") { Content = content };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiToken);

        using var response = await http.SendAsync(request, cts.Token);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning(rejectedLog, (int)response.StatusCode);
            return default;
        }

        return await onSuccess(response, cts.Token);
    }

    public void Dispose() => http.Dispose();
}

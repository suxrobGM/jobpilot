using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using JobPilot.Terminal.Common;

namespace JobPilot.Terminal.Pilot;

/// <summary>Body of a POST /api/pilot/journal request.</summary>
internal sealed record PilotJournalRequest(PilotJournalEntry[] Entries);

/// <summary>One journal entry; the host only ever writes <c>kind=system</c>.</summary>
internal sealed record PilotJournalEntry(string Kind, string Summary);

/// <summary>Body of a GET /api/pilot/activity response: the newest agent activity and open lease count.</summary>
internal sealed record PilotActivityResponse(DateTimeOffset? LastActivityAt, int ActiveLeases);

/// <summary>
/// Posts the conductor's own interventions to the API journal so the user's phone hears about them.
/// Best-effort: a briefly unreachable API logs a warning and never throws into the conductor loop.
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
    public async Task ReportSystemAsync(string apiUrl, string apiToken, string summary)
    {
        try
        {
            var body = new PilotJournalRequest([new PilotJournalEntry("system", summary)]);
            var json = JsonSerializer.Serialize(body, AppJsonContext.Default.PilotJournalRequest);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            await SendGuardedAsync<bool>(apiUrl, apiToken, HttpMethod.Post, "/api/pilot/journal", content,
                "Pilot journal report was rejected ({Status}).", static (_, _) => Task.FromResult<bool>(default));
        }
        catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException)
        {
            logger.LogWarning(ex, "Pilot journal report could not be delivered.");
        }
    }

    /// <summary>
    /// Probes the API for the newest agent activity, gating the watchdog ladder. Never throws: any failure
    /// returns null so the caller falls open to the old timeout behavior instead of blocking a cycle.
    /// </summary>
    public async Task<DateTimeOffset?> GetLastActivityAsync(string apiUrl, string apiToken, CancellationToken ct = default)
    {
        try
        {
            return await SendGuardedAsync<DateTimeOffset?>(apiUrl, apiToken, HttpMethod.Get, "/api/pilot/activity",
                content: null, "Pilot activity probe was rejected ({Status}).", async (response, token) =>
                {
                    var json = await response.Content.ReadAsStringAsync(token);
                    var activity = JsonSerializer.Deserialize(json, AppJsonContext.Default.PilotActivityResponse);
                    return activity?.LastActivityAt;
                }, ct);
        }
        catch (Exception ex)
        {
            // Fail-open on anything (transport, timeout, malformed body): the watchdog then uses its heuristics alone.
            logger.LogWarning(ex, "Pilot activity probe could not be delivered.");
            return null;
        }
    }

    /// <summary>
    /// Shared scaffolding for the two best-effort calls: unpaired guard, request timeout, base-URL join, Bearer
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

        // Linked so a cancelled conductor aborts the probe instead of waiting out the request timeout.
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

using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace JobPilot.Terminal.Pilot;

/// <summary>Body of a POST /api/pilot/journal request.</summary>
internal sealed record PilotJournalRequest(PilotJournalEntry[] Entries);

/// <summary>One journal entry; the host only ever writes <c>kind=system</c>.</summary>
internal sealed record PilotJournalEntry(string Kind, string Summary);

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
        : this(logger, PilotHttp.CreateLongLivedClient())
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
        if (string.IsNullOrWhiteSpace(apiUrl) || string.IsNullOrWhiteSpace(apiToken))
        {
            return; // Unpaired or a legacy pairing with no API URL; nothing to report to.
        }

        try
        {
            using var cts = new CancellationTokenSource(RequestTimeout);
            var body = new PilotJournalRequest([new PilotJournalEntry("system", summary)]);
            var json = JsonSerializer.Serialize(body, AppJsonContext.Default.PilotJournalRequest);

            using var request = new HttpRequestMessage(HttpMethod.Post, $"{apiUrl.TrimEnd('/')}/api/pilot/journal")
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiToken);

            using var response = await http.SendAsync(request, cts.Token);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Pilot journal report was rejected ({Status}).", (int)response.StatusCode);
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException)
        {
            logger.LogWarning(ex, "Pilot journal report could not be delivered.");
        }
    }

    public void Dispose() => http.Dispose();
}

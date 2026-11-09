using System.Net.Http.Headers;
using System.Text.Json.Serialization.Metadata;
using JobPilot.Terminal.Hosting;
using JobPilot.Terminal.Pilot.Pairing;

namespace JobPilot.Terminal.Pilot.Api;

/// <summary>
/// Calls for the paired account. Probes and reports throw only on the caller's cancellation, so a briefly unreachable
/// API cannot take the loop down, and while unpaired they send nothing and return null.
/// </summary>
public sealed class PilotApi(HttpClient http, PairingStore store, ILogger<PilotApi> logger) : IPilotApi
{
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(10);

    // A refresh runs maintenance and may pull mail first.
    private static readonly TimeSpan RefreshTimeout = TimeSpan.FromSeconds(60);

    public Task<PilotActivity?> GetActivityAsync(CancellationToken ct) =>
        SendAsync(HttpMethod.Get, "/api/pilot/activity", null, AppJsonContext.Default.PilotActivity, ct);

    public Task<PilotTaskList?> RefreshTasksAsync(CancellationToken ct) =>
        SendAsync(HttpMethod.Post, "/api/pilot/tasks/refresh", null, AppJsonContext.Default.PilotTaskList, ct, RefreshTimeout);

    public Task RecordCycleAsync(int sleepSeconds, string? message, CancellationToken ct) =>
        PostAsync(
            "/api/pilot/cycles",
            JsonContent.Create(new CycleRequest(sleepSeconds, message), AppJsonContext.Default.CycleRequest),
            ct);

    public Task<PilotRun?> StartRunAsync(string taskId, CancellationToken ct) =>
        SendAsync(
            HttpMethod.Post,
            "/api/pilot/runs",
            JsonContent.Create(new StartRunRequest(taskId), AppJsonContext.Default.StartRunRequest),
            AppJsonContext.Default.PilotRun,
            ct);

    public Task<PilotRun?> GetRunAsync(string runId, CancellationToken ct) =>
        SendAsync(HttpMethod.Get, $"/api/pilot/runs/{runId}", null, AppJsonContext.Default.PilotRun, ct);

    public Task CancelRunAsync(string runId, CancellationToken ct) =>
        PostAsync($"/api/pilot/runs/{runId}/cancel", null, ct);

    public Task ReportUsageAsync(string runId, PilotUsage usage, CancellationToken ct) =>
        PostAsync($"/api/pilot/runs/{runId}/usage", JsonContent.Create(usage, AppJsonContext.Default.PilotUsage), ct);

    public Task PostStepsAsync(string runId, PilotStep[] steps, CancellationToken ct) =>
        PostAsync($"/api/pilot/runs/{runId}/steps", JsonContent.Create(new PostStepsRequest(steps), AppJsonContext.Default.PostStepsRequest), ct);

    public async Task<HttpResponseMessage?> OpenEventsAsync(PilotPairing pairing, CancellationToken ct)
    {
        using var request = Request(pairing, HttpMethod.Get, "/api/pilot/events", null);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));
        var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if (response.IsSuccessStatusCode)
        {
            return response;
        }

        logger.LogWarning("Pilot event stream was rejected ({Status}).", (int)response.StatusCode);
        response.Dispose();
        return null;
    }

    private Task PostAsync(string path, HttpContent? content, CancellationToken ct) =>
        SendAsync<object>(HttpMethod.Post, path, content, null, ct);

    /// <summary>Reads the body only when <paramref name="read"/> is given; null on any rejection or failure.</summary>
    private async Task<T?> SendAsync<T>(
        HttpMethod method, string path, HttpContent? content, JsonTypeInfo<T>? read, CancellationToken ct, TimeSpan? timeoutAfter = null)
        where T : class
    {
        if (store.Current is not { } pairing)
        {
            return null;
        }

        using var request = Request(pairing, method, path, content);
        var route = $"{method} {path}";
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(timeoutAfter ?? RequestTimeout);
            using var response = await http.SendAsync(request, timeout.Token);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Pilot call {Route} was rejected ({Status}).", route, (int)response.StatusCode);
                return null;
            }

            return read is null ? null : await response.Content.ReadFromJsonAsync(read, timeout.Token);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Pilot call {Route} failed.", route);
            return null;
        }
    }

    private static HttpRequestMessage Request(PilotPairing pairing, HttpMethod method, string path, HttpContent? content) =>
        new(method, pairing.Api.Url + path)
        {
            Content = content,
            Headers = { Authorization = new AuthenticationHeaderValue("Bearer", pairing.Api.Token) },
        };
}

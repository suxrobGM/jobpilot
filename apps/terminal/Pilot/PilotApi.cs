using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;

namespace JobPilot.Terminal.Pilot;

/// <summary>GET /api/pilot/activity.</summary>
public sealed record PilotActivity(DateTimeOffset? LastActivityAt, CompletedCycle? LastCycle);

public sealed record CompletedCycle(DateTimeOffset CompletedAt, int? SleepSeconds);

/// <summary>The fields of POST /api/pilot/tasks/refresh the host reads.</summary>
public sealed record PilotTaskList(PilotTask[] Tasks, string Version, int SleepSeconds);

public sealed record PilotTask(string Id, string Title);

public sealed record PilotRun(string Id, DateTimeOffset? FinishedAt, string? Outcome);

internal sealed record StartRunRequest(string TaskId, string TaskListVersion);

internal sealed record IdleCycleRequest(int SleepSeconds);

internal sealed record JournalRequest(
    JournalEntry[] Entries,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? RunId = null);

internal sealed record JournalEntry(
    string Kind,
    string Summary,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] CycleDetail? Detail = null);

/// <summary>The API reads the run's task type and tokens from the run itself.</summary>
public sealed record CycleDetail(string Status, int SleepSeconds);

/// <summary>Probes and reports throw only on the caller's cancellation, so a briefly unreachable API cannot take the loop down.</summary>
public sealed class PilotApi(HttpClient http, ILogger<PilotApi> logger)
{
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(10);

    // A refresh runs maintenance and may pull mail first.
    private static readonly TimeSpan RefreshTimeout = TimeSpan.FromSeconds(60);

    public Task<PilotActivity?> GetActivityAsync(PilotSettings settings, CancellationToken ct) =>
        SendAsync(Request(settings, HttpMethod.Get, "/api/pilot/activity"), AppJsonContext.Default.PilotActivity, ct);

    /// <summary>Null when the refresh fails, including the 409 of a stopped pilot.</summary>
    public Task<PilotTaskList?> RefreshTasksAsync(PilotSettings settings, CancellationToken ct) =>
        SendAsync(Request(settings, HttpMethod.Post, "/api/pilot/tasks/refresh"), AppJsonContext.Default.PilotTaskList, ct, RefreshTimeout);

    public Task ReportAsync(PilotSettings settings, string summary, CancellationToken ct) =>
        PostJournalAsync(settings, new JournalRequest([new JournalEntry("system", summary)]), ct);

    /// <summary>The activity probe reads the cycle entry's detail back as the cycle's completion.</summary>
    public Task JournalCycleAsync(PilotSettings settings, string runId, string summary, CycleDetail detail, CancellationToken ct) =>
        PostJournalAsync(settings, new JournalRequest([new JournalEntry("cycle", summary, detail)], runId), ct);

    /// <summary>Recorded on the pilot state, not the journal; the activity probe reads it back.</summary>
    public Task RecordIdleCycleAsync(PilotSettings settings, int sleepSeconds, CancellationToken ct) =>
        PostAsync(settings, "/api/pilot/idle-checks", JsonContent.Create(new IdleCycleRequest(sleepSeconds), AppJsonContext.Default.IdleCycleRequest), ct);

    public Task<PilotRun?> StartRunAsync(PilotSettings settings, string taskId, string taskListVersion, CancellationToken ct)
    {
        var content = JsonContent.Create(new StartRunRequest(taskId, taskListVersion), AppJsonContext.Default.StartRunRequest);
        return SendAsync(Request(settings, HttpMethod.Post, "/api/pilot/runs", content), AppJsonContext.Default.PilotRun, ct);
    }

    public Task<PilotRun?> GetRunAsync(PilotSettings settings, string runId, CancellationToken ct) =>
        SendAsync(Request(settings, HttpMethod.Get, $"/api/pilot/runs/{runId}"), AppJsonContext.Default.PilotRun, ct);

    /// <summary>Closes the run as cancelled, which returns an applying job to the approved queue.</summary>
    public Task CancelRunAsync(PilotSettings settings, string runId, CancellationToken ct) =>
        PostAsync(settings, $"/api/pilot/runs/{runId}/cancel", null, ct);

    public Task ReportUsageAsync(PilotSettings settings, string runId, PilotUsage usage, CancellationToken ct) =>
        PostAsync(settings, $"/api/pilot/runs/{runId}/usage", JsonContent.Create(usage, AppJsonContext.Default.PilotUsage), ct);

    /// <summary>Null when the server rejects the stream. Unlike the calls above, transport failures throw.</summary>
    public async Task<HttpResponseMessage?> OpenEventsAsync(PilotSettings settings, CancellationToken ct)
    {
        var request = Request(settings, HttpMethod.Get, "/api/pilot/events");
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

    private Task PostJournalAsync(PilotSettings settings, JournalRequest body, CancellationToken ct) =>
        PostAsync(settings, "/api/pilot/journal", JsonContent.Create(body, AppJsonContext.Default.JournalRequest), ct);

    private Task PostAsync(PilotSettings settings, string path, HttpContent? content, CancellationToken ct) =>
        SendAsync<object>(Request(settings, HttpMethod.Post, path, content), null, ct);

    /// <summary>Reads the body only when <paramref name="read"/> is given; null on any rejection or failure.</summary>
    private async Task<T?> SendAsync<T>(
        HttpRequestMessage request, JsonTypeInfo<T>? read, CancellationToken ct, TimeSpan? timeoutAfter = null)
        where T : class
    {
        using var owned = request;
        var route = $"{request.Method} {request.RequestUri?.AbsolutePath}";
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

    private static HttpRequestMessage Request(PilotSettings settings, HttpMethod method, string path, HttpContent? content = null) =>
        new(method, settings.ApiUrl.TrimEnd('/') + path)
        {
            Content = content,
            Headers = { Authorization = new AuthenticationHeaderValue("Bearer", settings.ApiToken) },
        };
}

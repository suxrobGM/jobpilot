namespace JobPilot.Terminal.Pilot.Api;

/// <summary>The API calls the host makes. They return null on failure and throw only on the caller's cancellation.</summary>
public interface IPilotApi
{
    Task<PilotActivity?> GetActivityAsync(CancellationToken ct);

    /// <summary>Null when the refresh fails, including the 409 of a stopped pilot.</summary>
    Task<PilotTaskList?> RefreshTasksAsync(CancellationToken ct);

    Task ReportAsync(string summary, CancellationToken ct);

    /// <summary>Recorded on the pilot state; the activity probe reads it back as the cycle's completion.</summary>
    Task RecordCycleAsync(int sleepSeconds, CancellationToken ct);

    /// <summary>Null when the server refuses the start.</summary>
    Task<PilotRun?> StartRunAsync(string taskId, string taskListVersion, CancellationToken ct);

    Task<PilotRun?> GetRunAsync(string runId, CancellationToken ct);

    /// <summary>Closes the run as cancelled, which returns an applying job to the approved queue.</summary>
    Task CancelRunAsync(string runId, CancellationToken ct);

    Task ReportUsageAsync(string runId, PilotUsage usage, CancellationToken ct);

    Task PostStepsAsync(string runId, PilotStep[] steps, CancellationToken ct);

    /// <summary>
    /// Opens the stream with the given settings, so it never outlives the credentials it opened with. Null when the
    /// server rejects the stream; unlike the calls above, transport failures throw.
    /// </summary>
    Task<HttpResponseMessage?> OpenEventsAsync(PilotSettings settings, CancellationToken ct);
}

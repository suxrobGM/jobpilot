namespace JobPilot.Terminal.Pilot;

/// <summary>Shared HTTP client construction for the pilot's long-lived connections.</summary>
internal static class PilotHttp
{
    /// <summary>No client timeout (callers bound requests themselves); the pooled lifetime lets a long-lived host follow DNS.</summary>
    public static HttpClient CreateLongLivedClient() =>
        new(new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(15) })
        {
            Timeout = Timeout.InfiniteTimeSpan,
        };
}

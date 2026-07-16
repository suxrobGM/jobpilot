namespace JobPilot.Terminal.Common;

/// <summary>Shared HttpClient construction for the host's long-lived outbound connections.</summary>
internal static class HttpClients
{
    /// <summary>No client timeout (callers bound requests themselves); the pooled lifetime lets a long-lived host follow DNS.</summary>
    public static HttpClient CreateLongLivedClient() =>
        new(new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(15) })
        {
            Timeout = Timeout.InfiniteTimeSpan,
        };
}

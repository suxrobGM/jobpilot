namespace JobPilot.Terminal.Hosting;

/// <summary>Gracefully stops the host after a shutdown request's response has flushed.</summary>
public static class HostShutdown
{
    /// <summary>
    /// Stops the application shortly after the caller's response flushes. The registered ApplicationStopping hook
    /// stops the PTY session and the pilot conductor loop; pilot.json is left untouched so a later start resumes.
    /// </summary>
    public static void BeginShutdown(IHostApplicationLifetime lifetime) => GracefulStop.Schedule(lifetime);
}

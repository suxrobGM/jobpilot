namespace JobPilot.Terminal.Hosting;

/// <summary>Gracefully stops the host after a shutdown request's response has flushed.</summary>
public static class HostShutdown
{
    // Give Kestrel time to flush the 200 before the process starts tearing down (mirrors HostHandoff's flush).
    private static readonly TimeSpan ResponseFlush = TimeSpan.FromMilliseconds(500);

    /// <summary>
    /// Stops the application shortly after the caller's response flushes. The registered ApplicationStopping hook
    /// stops the PTY session and the pilot conductor loop; pilot.json is left untouched so a later start resumes.
    /// </summary>
    public static void BeginShutdown(IHostApplicationLifetime lifetime)
    {
        _ = Task.Run(async () =>
        {
            await Task.Delay(ResponseFlush, CancellationToken.None);
            lifetime.StopApplication(); // -> ApplicationStopping -> SessionManager.Stop() + conductor cancel -> exit
        }, CancellationToken.None);
    }
}

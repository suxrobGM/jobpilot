namespace JobPilot.Terminal.Hosting;

/// <summary>Stops the host after an in-flight response has had time to flush.</summary>
public static class GracefulStop
{
    // Give Kestrel time to flush the caller's 200 before the process starts tearing down.
    private static readonly TimeSpan ResponseFlush = TimeSpan.FromMilliseconds(500);

    /// <summary>
    /// Stops the application shortly after the caller's response flushes. Cancellation is intentionally ignored so a
    /// pending shutdown/handoff always releases the port; the ApplicationStopping hook does the actual teardown.
    /// </summary>
    public static void Schedule(IHostApplicationLifetime lifetime)
    {
        _ = Task.Run(async () =>
        {
            await Task.Delay(ResponseFlush, CancellationToken.None);
            lifetime.StopApplication(); // -> ApplicationStopping -> SessionManager.Stop() (+ conductor cancel) -> exit
        }, CancellationToken.None);
    }
}

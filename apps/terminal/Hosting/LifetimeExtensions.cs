namespace JobPilot.Terminal.Hosting;

internal static class LifetimeExtensions
{
    // Long enough for Kestrel to flush the caller's 200 before teardown starts.
    private static readonly TimeSpan ResponseFlush = TimeSpan.FromMilliseconds(500);

    /// <summary>Stops the host once the caller's response has flushed. Ignores cancellation, so the port is always released.</summary>
    public static void StopAfterResponse(this IHostApplicationLifetime lifetime) =>
        _ = Task.Run(async () =>
        {
            await Task.Delay(ResponseFlush, CancellationToken.None);
            lifetime.StopApplication();
        }, CancellationToken.None);
}

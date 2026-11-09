namespace JobPilot.Terminal.Install.Updates;

/// <summary>Updates the host in the background when the API refuses it as too old.</summary>
public interface IHostSelfUpdate
{
    /// <summary>Starts at most one update; later calls while it runs do nothing.</summary>
    void Start();
}

/// <summary>On success it stops this process, as the dashboard's update does, so the new host can bind.</summary>
public sealed class HostSelfUpdate(HostUpdater updates, IHostApplicationLifetime lifetime, ILogger<HostSelfUpdate> logger)
    : IHostSelfUpdate
{
    private int started;

    public void Start()
    {
        if (Interlocked.Exchange(ref started, 1) == 1)
        {
            return;
        }

        _ = Task.Run(async () =>
        {
            var result = await updates.UpdateNowAsync(lifetime.ApplicationStopping);
            if (result.Updating)
            {
                logger.LogInformation("The API needs a newer host; updated to v{Next}, restarting.", result.ToVersion);
                lifetime.StopApplication();
                return;
            }

            logger.LogWarning("The API needs a newer host, but no update ran ({Reason}).", result.Reason);
            Interlocked.Exchange(ref started, 0);
        });
    }
}

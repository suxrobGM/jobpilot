using System.Diagnostics;
using JobPilot.Terminal.Hosting;

namespace JobPilot.Terminal.Updates;

/// <summary>Coordinates the listening-port handoff after a runtime update.</summary>
public static class HostHandoff
{
    /// <summary>Environment variable carrying the predecessor process ID.</summary>
    public const string AwaitPidVar = "JOBPILOT_AWAIT_PID";

    private static readonly TimeSpan MaxWait = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan Poll = TimeSpan.FromMilliseconds(150);
    private static readonly TimeSpan SocketDrain = TimeSpan.FromMilliseconds(300);

    /// <summary>
    /// Whether this process is an update relaunch. A relaunched child skips its own startup update check:
    /// it avoids a redundant release fetch and breaks the relaunch loop a mis-versioned release would cause.
    /// </summary>
    public static bool IsUpdateRelaunch => Environment.GetEnvironmentVariable(AwaitPidVar) is not null;

    /// <summary>Stops the parent after its update response has flushed so the waiting child can bind the port.</summary>
    public static void BeginRelease(IHostApplicationLifetime lifetime) => GracefulStop.Schedule(lifetime);

    /// <summary>Waits briefly for the predecessor to release the port.</summary>
    public static async Task WaitForParentExitAsync(ILogger logger)
    {
        var raw = Environment.GetEnvironmentVariable(AwaitPidVar);
        Environment.SetEnvironmentVariable(AwaitPidVar, null);
        if (!int.TryParse(raw, out var pid))
        {
            return;
        }

        logger.LogInformation("Waiting for previous host (pid {Pid}) to exit before binding.", pid);
        var deadline = DateTime.UtcNow + MaxWait;
        while (DateTime.UtcNow < deadline)
        {
            try
            {
                using var previous = Process.GetProcessById(pid);
                if (previous.HasExited)
                {
                    break;
                }
            }
            catch (ArgumentException)
            {
                break;
            }
            await Task.Delay(Poll);
        }

        await Task.Delay(SocketDrain);
    }
}

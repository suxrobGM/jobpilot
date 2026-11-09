using System.Diagnostics;
using System.Globalization;

namespace JobPilot.Terminal.Install.Updates;

/// <summary>Hands the listening port from an updated host to the one it launched.</summary>
public static class HostRelaunch
{
    /// <summary>Carries the previous host's process id to the relaunched one.</summary>
    private const string AwaitPidVar = "JOBPILOT_AWAIT_PID";

    private static readonly TimeSpan MaxWait = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan SocketDrain = TimeSpan.FromMilliseconds(300);

    /// <summary>
    /// A relaunched host skips its own startup update: it saves a release fetch and breaks the relaunch loop a
    /// mis-versioned release would cause.
    /// </summary>
    public static bool IsUpdateRelaunch => Environment.GetEnvironmentVariable(AwaitPidVar) is not null;

    /// <summary>Starts the installed binary with this process's arguments; it waits for this process to exit.</summary>
    public static void Relaunch(string exePath)
    {
        var start = new ProcessStartInfo
        {
            FileName = exePath,
            UseShellExecute = false,
            WorkingDirectory = Environment.CurrentDirectory,
        };
        foreach (var arg in Environment.GetCommandLineArgs().Skip(1))
        {
            start.ArgumentList.Add(arg);
        }

        start.Environment[AwaitPidVar] = Environment.ProcessId.ToString(CultureInfo.InvariantCulture);
        Process.Start(start);
    }

    /// <summary>After a relaunch, waits briefly for the previous host to release the port.</summary>
    public static async Task WaitForPreviousHostAsync(ILogger logger)
    {
        var raw = Environment.GetEnvironmentVariable(AwaitPidVar);
        Environment.SetEnvironmentVariable(AwaitPidVar, null);
        if (!int.TryParse(raw, out var pid))
        {
            return;
        }

        logger.LogInformation("Waiting for the previous host (pid {Pid}) to exit before binding.", pid);
        using var timeout = new CancellationTokenSource(MaxWait);
        try
        {
            using var previous = Process.GetProcessById(pid);
            await previous.WaitForExitAsync(timeout.Token);
        }
        catch (Exception ex) when (ex is ArgumentException or OperationCanceledException)
        {
            // Already gone, or still holding the port after MaxWait: bind anyway and let Kestrel report it.
        }

        await Task.Delay(SocketDrain);
    }
}

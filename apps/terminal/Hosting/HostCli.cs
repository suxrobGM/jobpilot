using Microsoft.Extensions.Logging.Abstractions;

namespace JobPilot.Terminal.Hosting;

/// <summary>Handles terminal host commands that complete without starting the web host.</summary>
internal static class HostCli
{
    /// <summary>Runs a one-shot command using the process console and host services.</summary>
    public static bool TryRunCommand(string[] args) =>
        TryRunCommand(args, Console.Out, () => ProtocolRegistrar.Unregister(NullLogger.Instance));

    /// <summary>Runs a one-shot command, returning whether normal host startup should stop.</summary>
    internal static bool TryRunCommand(string[] args, TextWriter output, Action unregister)
    {
        if (HasFlag(args, "--version"))
        {
            output.WriteLine($"jobpilot {HostInstall.HostVersion}");
            return true;
        }

        if (HasFlag(args, "--unregister"))
        {
            unregister();
            output.WriteLine("JobPilot: removed the jobpilot:// URL scheme.");
            return true;
        }

        return false;
    }

    private static bool HasFlag(string[] args, string flag) =>
        args.Any(arg => arg.Equals(flag, StringComparison.OrdinalIgnoreCase));
}

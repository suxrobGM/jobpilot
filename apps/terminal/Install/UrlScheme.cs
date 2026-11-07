using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using Microsoft.Win32;

namespace JobPilot.Terminal.Install;

/// <summary>The Windows <c>jobpilot://</c> URL scheme the dashboard uses to relaunch the host.</summary>
public sealed partial class UrlScheme(ILogger<UrlScheme> logger)
{
    private const string Scheme = "jobpilot";
    private const string SchemeKey = $@"Software\Classes\{Scheme}";
    private const string CommandKey = $@"{SchemeKey}\shell\open\command";

    public bool IsRegistered { get; private set; }

    /// <summary>Drops the jobpilot:// launch argument, and the console window the shell opens with it.</summary>
    public static string[] StripSchemeArgs(string[] args)
    {
        var hostArgs = args.Where(a => !a.StartsWith($"{Scheme}://", StringComparison.OrdinalIgnoreCase)).ToArray();
        if (hostArgs.Length != args.Length && OperatingSystem.IsWindows())
        {
            FreeConsole();
        }

        return hostArgs;
    }

    /// <summary>Points the scheme at this executable. Best-effort; a failure only disables relaunch.</summary>
    public void Register()
    {
        if (!OperatingSystem.IsWindows() || string.IsNullOrEmpty(Environment.ProcessPath))
        {
            return;
        }

        var exePath = Environment.ProcessPath;
        try
        {
            // A build output must not own the scheme: the dashboard would launch a binary running the repo's plugin
            // tree instead of the one it shipped with.
            if (!HostInstall.IsPublishedHost)
            {
                IsRegistered = ReleaseFromBuildOutput(exePath);
                return;
            }

            var command = $"\"{exePath}\" \"%1\"";
            using var commandKey = Registry.CurrentUser.CreateSubKey(CommandKey);
            if (commandKey.GetValue(null) as string != command)
            {
                using var schemeKey = Registry.CurrentUser.CreateSubKey(SchemeKey);
                schemeKey.SetValue(null, "URL:JobPilot Protocol");
                schemeKey.SetValue("URL Protocol", "");
                commandKey.SetValue(null, command);
                logger.LogInformation("Registered the {Scheme}:// URL scheme.", Scheme);
            }

            IsRegistered = true;
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Could not register the {Scheme}:// URL scheme.", Scheme);
        }
    }

    public static void Unregister(ILogger logger)
    {
        if (!OperatingSystem.IsWindows())
        {
            return;
        }

        try
        {
            Registry.CurrentUser.DeleteSubKeyTree(SchemeKey, throwOnMissingSubKey: false);
            logger.LogInformation("Removed the {Scheme}:// URL scheme.", Scheme);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Could not remove the {Scheme}:// URL scheme.", Scheme);
        }
    }

    /// <summary>Removes a registration an earlier build output left, keeping an installed host's. Returns whether one remains.</summary>
    [SupportedOSPlatform("windows")]
    private bool ReleaseFromBuildOutput(string exePath)
    {
        using var commandKey = Registry.CurrentUser.OpenSubKey(CommandKey);
        if (commandKey?.GetValue(null) is not string { Length: > 0 } command)
        {
            return false;
        }

        if (!command.Contains(exePath, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        Unregister(logger);
        return false;
    }

    [LibraryImport("kernel32")]
    private static partial void FreeConsole();
}

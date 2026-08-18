using System.Runtime.Versioning;
using Microsoft.Win32;

namespace JobPilot.Terminal.Pty;

/// <summary>
/// Repairs the PATH handed to PTY children: a protocol-activated host (jobpilot://) can inherit
/// one without the machine entries, and every session would be born broken.
/// </summary>
public static class PtyEnvironment
{
    private const string MachineEnvKey = @"SYSTEM\CurrentControlSet\Control\Session Manager\Environment";

    /// <summary>Windows' own default, used when a stripped environment carries no PATHEXT.</summary>
    internal const string DefaultPathExt = ".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC";

    private const StringSplitOptions CleanSplit =
        StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries;

    /// <summary>Returns PATH-related overrides to merge into the PTY child's environment.</summary>
    public static Dictionary<string, string> BuildOverrides()
    {
        // Only Windows protocol activation strips the inherited PATH; elsewhere Pty.Net's is fine.
        if (!OperatingSystem.IsWindows())
        {
            return [];
        }

        return BuildWindowsOverrides(
            Environment.GetEnvironmentVariable("PATH"),
            ReadRegistryPath(Registry.LocalMachine, MachineEnvKey),
            ReadRegistryPath(Registry.CurrentUser, "Environment"),
            Environment.GetEnvironmentVariable("SystemRoot"),
            Environment.GetEnvironmentVariable("ComSpec"),
            Environment.GetEnvironmentVariable("PATHEXT"));
    }

    /// <summary>Inherited PATH first, then registry PATH entries it lost, system dirs guaranteed.</summary>
    internal static Dictionary<string, string> BuildWindowsOverrides(
        string? inheritedPath,
        string? machinePath,
        string? userPath,
        string? systemRoot,
        string? comSpec,
        string? pathExt)
    {
        var root = string.IsNullOrEmpty(systemRoot) ? @"C:\Windows" : systemRoot;
        var systemDirs = $@"{root}\System32;{root};{root}\System32\Wbem;{root}\System32\WindowsPowerShell\v1.0";

        var path = string.Join(';', new[] { inheritedPath, machinePath, userPath, systemDirs }
            .Where(p => !string.IsNullOrEmpty(p))
            .SelectMany(p => p!.Split(';', CleanSplit))
            .DistinctBy(e => e.TrimEnd('\\'), StringComparer.OrdinalIgnoreCase));

        var overrides = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["PATH"] = path,
        };
        if (string.IsNullOrEmpty(systemRoot)) overrides["SystemRoot"] = root;
        if (string.IsNullOrEmpty(comSpec)) overrides["ComSpec"] = $@"{root}\System32\cmd.exe";
        if (string.IsNullOrEmpty(pathExt)) overrides["PATHEXT"] = DefaultPathExt;
        return overrides;
    }

    [SupportedOSPlatform("windows")]
    private static string? ReadRegistryPath(RegistryKey hive, string subKey)
    {
        try
        {
            using var key = hive.OpenSubKey(subKey);
            // Expand %SystemRoot%-style values; REG_EXPAND_SZ is the norm for machine PATH.
            return key?.GetValue("Path", null, RegistryValueOptions.None) as string;
        }
        catch
        {
            return null;
        }
    }
}

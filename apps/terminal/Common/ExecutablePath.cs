namespace JobPilot.Terminal.Common;

/// <summary>
/// Resolves a bare command name to a file <c>CreateProcess</c> can start. Codex spawns stdio MCP
/// servers with no shell, so a Windows launcher like npx.cmd never starts from the bare name.
/// </summary>
public static class ExecutablePath
{
    /// <summary>Absolute path to <paramref name="command"/>, or null when PATH has no match.</summary>
    public static string? Find(string command)
    {
        if (string.IsNullOrWhiteSpace(command))
        {
            return null;
        }

        if (Path.IsPathRooted(command) || command.Contains(Path.DirectorySeparatorChar) || command.Contains('/'))
        {
            return File.Exists(command) ? command : null;
        }

        foreach (var directory in SearchDirectories())
        {
            foreach (var candidate in Candidates(command))
            {
                var full = Path.Combine(directory, candidate);
                if (File.Exists(full))
                {
                    return full;
                }
            }
        }

        return null;
    }

    /// <summary>True when the resolved file needs a command interpreter rather than a direct spawn.</summary>
    public static bool NeedsShell(string path) =>
        OperatingSystem.IsWindows()
        && Path.GetExtension(path) is { } ext
        && (ext.Equals(".cmd", StringComparison.OrdinalIgnoreCase)
            || ext.Equals(".bat", StringComparison.OrdinalIgnoreCase));

    private static IEnumerable<string> SearchDirectories()
    {
        var path = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        foreach (var entry in path.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            var trimmed = entry.Trim().Trim('"');
            if (trimmed.Length > 0)
            {
                yield return trimmed;
            }
        }
    }

    private static IEnumerable<string> Candidates(string command)
    {
        if (!OperatingSystem.IsWindows())
        {
            yield return command;
            yield break;
        }

        // A real executable first, then the shims: only the former spawns without an interpreter.
        foreach (var ext in Extensions())
        {
            yield return command + ext;
        }

        yield return command;
    }

    private static IEnumerable<string> Extensions()
    {
        yield return ".exe";
        var pathExt = Environment.GetEnvironmentVariable("PATHEXT") ?? ".COM;.EXE;.BAT;.CMD";
        foreach (var ext in pathExt.Split(';', StringSplitOptions.RemoveEmptyEntries))
        {
            var trimmed = ext.Trim();
            if (trimmed.StartsWith('.') && !trimmed.Equals(".exe", StringComparison.OrdinalIgnoreCase))
            {
                yield return trimmed;
            }
        }
    }
}

using JobPilot.Terminal.Pty;

namespace JobPilot.Terminal.Common;

/// <summary>
/// Resolves a bare command name to a file <c>CreateProcess</c> can start. Codex spawns stdio MCP
/// servers with no shell, so a Windows launcher like npx.cmd never starts from the bare name.
/// </summary>
public static class ExecutablePath
{
    // Resolve against the PATH the agent process gets, not the host's: a protocol-activated host
    // (jobpilot://) inherits one without the machine entries, which is why PtyEnvironment exists.
    private static readonly Lazy<Dictionary<string, string>> ChildEnvironment = new(PtyEnvironment.BuildOverrides);

    /// <summary>Absolute path to <paramref name="command"/>, or null when PATH has no match.</summary>
    public static string? Find(string command) =>
        Find(command, Variable("PATH"), Variable("PATHEXT"), OperatingSystem.IsWindows());

    /// <summary>True when the resolved file needs a command interpreter rather than a direct spawn.</summary>
    public static bool NeedsShell(string path) =>
        OperatingSystem.IsWindows()
        && Path.GetExtension(path) is { } ext
        && (ext.Equals(".cmd", StringComparison.OrdinalIgnoreCase)
            || ext.Equals(".bat", StringComparison.OrdinalIgnoreCase));

    internal static string? Find(string command, string? path, string? pathExt, bool windows)
    {
        if (string.IsNullOrWhiteSpace(command))
        {
            return null;
        }

        if (Path.IsPathRooted(command) || command.Contains(Path.DirectorySeparatorChar) || command.Contains('/'))
        {
            return File.Exists(command) ? command : null;
        }

        foreach (var directory in SearchDirectories(path))
        {
            foreach (var candidate in Candidates(command, pathExt, windows))
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

    private static string? Variable(string name) =>
        ChildEnvironment.Value.TryGetValue(name, out var value)
            ? value
            : Environment.GetEnvironmentVariable(name);

    private static IEnumerable<string> SearchDirectories(string? path)
    {
        foreach (var entry in (path ?? string.Empty).Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            var trimmed = entry.Trim().Trim('"');
            if (trimmed.Length > 0)
            {
                yield return trimmed;
            }
        }
    }

    private static IEnumerable<string> Candidates(string command, string? pathExt, bool windows)
    {
        if (!windows)
        {
            yield return command;
            yield break;
        }

        // A real executable first, then the shims: only the former spawns without an interpreter.
        foreach (var ext in Extensions(pathExt))
        {
            yield return command + ext;
        }

        yield return command;
    }

    private static IEnumerable<string> Extensions(string? pathExt)
    {
        yield return ".exe";
        foreach (var ext in (pathExt ?? PtyEnvironment.DefaultPathExt).Split(';', StringSplitOptions.RemoveEmptyEntries))
        {
            var trimmed = ext.Trim();
            if (trimmed.StartsWith('.') && !trimmed.Equals(".exe", StringComparison.OrdinalIgnoreCase))
            {
                yield return trimmed;
            }
        }
    }
}

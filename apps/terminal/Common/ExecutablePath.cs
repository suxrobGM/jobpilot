using JobPilot.Terminal.Pty;

namespace JobPilot.Terminal.Common;

/// <summary>
/// Resolves a bare command name to a file <c>CreateProcess</c> can start. Codex spawns stdio MCP
/// servers with no shell, so a Windows launcher like npx.cmd never starts from the bare name.
/// </summary>
public static class ExecutablePath
{
    private static readonly string[] ShellExtensions = [".cmd", ".bat"];

    // Resolve against the PATH the agent process gets, not the host's: a protocol-activated host
    // (jobpilot://) inherits one without the machine entries, which is why PtyEnvironment exists.
    private static readonly Lazy<Dictionary<string, string>> ChildEnvironment = new(PtyEnvironment.BuildOverrides);

    /// <summary>Absolute path to <paramref name="command"/>, or null when PATH has no match.</summary>
    public static string? Find(string command) =>
        Find(command, Variable("PATH"), Variable("PATHEXT"), OperatingSystem.IsWindows());

    /// <summary>True when the resolved file needs a command interpreter rather than a direct spawn.</summary>
    public static bool NeedsShell(string path) =>
        OperatingSystem.IsWindows()
        && ShellExtensions.Contains(Path.GetExtension(path), StringComparer.OrdinalIgnoreCase);

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

        var candidates = Candidates(command, pathExt, windows);

        foreach (var entry in Split(path, Path.PathSeparator))
        {
            var directory = entry.Trim('"');
            if (directory.Length == 0)
            {
                continue;
            }

            foreach (var candidate in candidates)
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

    private static string[] Split(string? value, char separator) =>
        (value ?? string.Empty).Split(separator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static string[] Candidates(string command, string? pathExt, bool windows)
    {
        if (!windows)
        {
            return [command];
        }

        // A real executable first, then the shims: only the former spawns without an interpreter.
        var extensions = Split(pathExt ?? PtyEnvironment.DefaultPathExt, ';')
            .Where(ext => ext.StartsWith('.') && !ext.Equals(".exe", StringComparison.OrdinalIgnoreCase));

        return [command + ".exe", .. extensions.Select(ext => command + ext), command];
    }
}

using JobPilot.Terminal.Install;
using JobPilot.Terminal.Sessions.Pty;

namespace JobPilot.Terminal.Sessions;

/// <summary>What a provider process gets on top of the host's own environment, which Pty.Net merges it over.</summary>
internal static class SessionEnvironment
{
    public static Dictionary<string, string> Build(InstallPaths paths, ApiConnection api)
    {
        // macOS ships en_US.UTF-8, not C.UTF-8; without a UTF-8 locale spawned tools mangle non-ASCII.
        var utf8Locale = OperatingSystem.IsMacOS() ? "en_US.UTF-8" : "C.UTF-8";
        var env = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["TERM"] = "xterm-256color",
            ["LANG"] = utf8Locale,
            ["LC_ALL"] = utf8Locale,
            ["PYTHONUTF8"] = "1",
        };

        foreach (var (key, value) in PtyEnvironment.BuildOverrides())
        {
            env[key] = value;
        }

        var inherited = env.GetValueOrDefault("PATH") ?? Environment.GetEnvironmentVariable("PATH");
        env["PATH"] = string.IsNullOrEmpty(inherited) ? paths.BinDir : paths.BinDir + Path.PathSeparator + inherited;
        // Git Bash rebuilds PATH from an inherited ORIGINAL_PATH, dropping BinDir; empty unsets it.
        env["ORIGINAL_PATH"] = "";

        env["JOBPILOT_SKILLS_ROOT"] = paths.SkillsDir;
        env["JOBPILOT_WORKSPACE_ROOT"] = paths.WorkingDir;
        // Skills write scratch files here; a shell-local TEMP would not survive between tool calls.
        env["JOBPILOT_TEMP"] = Directory.CreateDirectory(paths.ScratchDir).FullName;
        env["JOBPILOT_API"] = api.Url;
        env["JOBPILOT_API_TOKEN"] = api.Token;
        env["JOBPILOT_WEB"] = api.WebUrl;
        return env;
    }
}

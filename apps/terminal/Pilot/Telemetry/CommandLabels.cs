using System.Text.Json;
using System.Text.RegularExpressions;

namespace JobPilot.Terminal.Pilot.Telemetry;

/// <summary>Labels a shell command: a `jobpilot-api` call by its route, anything else by its program.</summary>
internal static partial class CommandLabels
{
    public static string? For(JsonElement? args) => Label(Command(args));

    // Routes the skills call, by method and path; `*` is any one segment.
    private static readonly (string Method, Regex Path, string? Label)[] ApiRoutes =
    [
        ("POST", ApiPath("pilot/runs/*/heartbeat"), null),
        ("POST", ApiPath("pilot/runs/*/result"), "Posted the result"),
        ("POST", ApiPath("feeds/*/jobs"), "Added jobs"),
        ("PATCH", ApiPath("feeds/*/jobs/*"), "Updated a job"),
        ("POST", ApiPath("feeds/*/jobs/*/rescan"), "Rescanned a job"),
        ("POST", ApiPath("feeds/*/networking/messages"), "Drafted outreach"),
        ("POST", ApiPath("feeds/*/networking/messages/*/result"), "Recorded an outreach result"),
        ("POST", ApiPath("feeds"), "Opened a feed"),
        ("POST", ApiPath("fit-scores"), "Scored jobs"),
        ("POST", ApiPath("cover-letters"), "Wrote a cover letter"),
        ("POST", ApiPath("cover-letters/pdf"), "Made a cover letter PDF"),
        ("POST", ApiPath("resumes/*/variants"), "Tailored a resume"),
        ("GET", ApiPath("credentials/resolve"), "Looked up a saved login"),
        ("POST", ApiPath("captcha/solve"), "Solved a captcha"),
        ("POST", ApiPath("applications/*/events"), "Logged an application update"),
        ("POST", ApiPath("pilot/questions"), "Asked you a question"),
        ("POST", ApiPath("pilot/changes"), "Made a change"),
        ("POST", ApiPath("pilot/requests"), "Queued work"),
        ("POST", ApiPath("pilot/messages"), "Replied to you"),
        ("POST", ApiPath("pilot/jobs/existing"), "Checked for jobs you already have"),
        ("POST", ApiPath("email/sync"), "Synced the inbox"),
        ("GET", ApiPath("email/messages"), "Read the inbox"),
        ("PATCH", ApiPath("email/messages/*"), "Sorted an email"),
        ("POST", ApiPath("email/outbound"), "Sent an email"),
        ("POST", ApiPath("upwork/proposals"), "Drafted a proposal"),
    ];

    /// <summary>A `jobpilot-api` call gets its route's label; anything else shows only the program.</summary>
    private static string? Label(string? command)
    {
        if (command is null)
        {
            return null;
        }

        var words = Words().Matches(command).Select(m => m.Value.Trim('"', '\'')).ToArray();
        var api = Array.FindIndex(words, w => w.EndsWith("jobpilot-api", StringComparison.Ordinal));
        if (api >= 0)
        {
            return api + 2 < words.Length ? ApiLabel(words[api + 1].ToUpperInvariant(), words[api + 2]) : "Called JobPilot";
        }

        var program = words.FirstOrDefault(w => !w.Contains('='));
        return program is null ? null : $"Ran {Path.GetFileNameWithoutExtension(program.Replace('\\', '/'))}";
    }

    private static string? ApiLabel(string method, string path)
    {
        var route = path.Split('?')[0].TrimEnd('/');
        foreach (var (routeMethod, pattern, label) in ApiRoutes)
        {
            if (routeMethod == method && pattern.IsMatch(route))
            {
                return label;
            }
        }

        return method == "GET" ? "Read from JobPilot" : "Saved to JobPilot";
    }

    private static string? Command(JsonElement? args)
    {
        if (args is not { ValueKind: JsonValueKind.Object } value)
        {
            return null;
        }

        foreach (var key in (string[])["command", "cmd"])
        {
            if (!value.TryGetProperty(key, out var command))
            {
                continue;
            }

            if (command.ValueKind == JsonValueKind.String)
            {
                return command.GetString();
            }

            // Codex's `shell` takes argv, often ["bash", "-lc", "<script>"]; the script is what ran.
            if (command.ValueKind == JsonValueKind.Array)
            {
                var argv = command.EnumerateArray().Select(a => a.GetString() ?? "").ToArray();
                var script = argv.Length >= 3 && argv[1] is "-lc" or "-c";
                return script ? argv[2] : string.Join(' ', argv);
            }
        }

        return null;
    }

    private static Regex ApiPath(string route) =>
        new("^/api/" + Regex.Escape(route).Replace(@"\*", "[^/]+") + "$", RegexOptions.CultureInvariant);

    [GeneratedRegex("\"[^\"]*\"|'[^']*'|\\S+")]
    private static partial Regex Words();
}

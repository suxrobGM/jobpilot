using System.Text.Json;
using System.Text.RegularExpressions;

namespace JobPilot.Terminal.Pilot;

/// <summary>One tool call as both CLIs report it: the bare tool name and its arguments.</summary>
public sealed record ToolCall(string Name, JsonElement? Arguments);

/// <summary>
/// Turns a tool call into a short readable step. Labels only: never typed values, page text, query
/// strings or whole commands, because the steps leave the machine for the web.
/// </summary>
public static partial class StepMapper
{
    private const int MaxTarget = 60;

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
        ("POST", ApiPath("pilot/promotions"), "Drafted a post"),
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

    /// <summary>The tool call in a log record, or null for any other event.</summary>
    public static ToolCall? FromRecord(Dictionary<string, JsonElement> attributes)
    {
        var name = OtlpLogs.Text(attributes, "event.name");
        if (name is "tool_result" or "claude_code.tool_result")
        {
            var tool = OtlpLogs.Text(attributes, "tool_name");
            if (tool == "mcp_tool")
            {
                tool = Property(Parse(OtlpLogs.Text(attributes, "tool_parameters")), "mcp_tool_name");
            }

            return tool is null ? null : new ToolCall(tool, Parse(OtlpLogs.Text(attributes, "tool_input")));
        }

        // Codex's code-mode `exec` wraps calls that each report on their own.
        if (name == "codex.tool_result" && OtlpLogs.Text(attributes, "tool_name") is { } codexTool and not "exec")
        {
            return new ToolCall(BareName(codexTool), Parse(OtlpLogs.Text(attributes, "arguments")));
        }

        return null;
    }

    public static string? Label(ToolCall call)
    {
        var args = call.Arguments;
        return call.Name switch
        {
            "Bash" or "exec_command" or "shell" or "shell_command" or "local_shell" => CommandLabel(Command(args)),
            "Agent" or "Task" => Started(Property(args, "subagent_type")),
            "spawn_agent" => Started(Property(args, "agent_type") ?? Property(args, "agent") ?? Property(args, "name")),
            "Skill" => Shorten(Property(args, "skill")) is { } skill ? $"Used the {skill} skill" : null,
            "Read" or "view_image" => "Read a file",
            "Write" => "Wrote a file",
            "Edit" or "MultiEdit" or "NotebookEdit" or "apply_patch" => "Edited a file",
            "Glob" or "Grep" => "Searched files",
            "WebFetch" => Host(Property(args, "url")) is { } host ? $"Fetched {host}" : "Fetched a page",
            "WebSearch" or "web_search" => "Searched the web",
            _ when call.Name.StartsWith("browser_", StringComparison.Ordinal) => BrowserLabel(call.Name, args),
            _ => null,
        };
    }

    private static string BrowserLabel(string tool, JsonElement? args)
    {
        var target = Shorten(Property(args, "element")) ?? "an element";
        return tool switch
        {
            "browser_navigate" => Page(Property(args, "url")) is { } page ? $"Opened {page}" : "Opened a page",
            "browser_click" => $"Clicked {target}",
            "browser_fill_form" => FilledLabel(Count(args, "fields")),
            "browser_type" => $"Typed into {target}",
            "browser_select_option" => $"Picked an option in {target}",
            "browser_hover" => $"Hovered {target}",
            "browser_press_key" => Shorten(Property(args, "key")) is { } key ? $"Pressed {key}" : "Pressed a key",
            "browser_file_upload" => "Uploaded a file",
            "browser_snapshot" => "Read the page",
            "browser_take_screenshot" => "Took a screenshot",
            "browser_wait_for" => "Waited on the page",
            "browser_navigate_back" => "Went back",
            "browser_tabs" => "Switched tabs",
            "browser_handle_dialog" => "Answered a dialog",
            "browser_evaluate" or "browser_run_code" or "browser_run_code_unsafe" => "Ran a script on the page",
            "browser_close" => "Closed the browser",
            _ => "Used the browser",
        };
    }

    private static string FilledLabel(int fields) => fields switch
    {
        0 => "Filled a form",
        1 => "Filled 1 field",
        _ => $"Filled {fields} fields",
    };

    /// <summary>A `jobpilot-api` call gets its route's label; anything else shows only the program.</summary>
    private static string? CommandLabel(string? command)
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

    private static string Started(string? agent) => Shorten(agent) is { } name ? $"Started {name}" : "Started a helper";

    /// <summary>Host and path only: a query string can carry tokens or search terms.</summary>
    private static string? Page(string? url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            return null;
        }

        var host = uri.Host.StartsWith("www.", StringComparison.Ordinal) ? uri.Host[4..] : uri.Host;
        return Shorten(host + uri.AbsolutePath.TrimEnd('/'), 80);
    }

    private static string? Host(string? url) => Uri.TryCreate(url, UriKind.Absolute, out var uri) ? uri.Host : null;

    private static string? Shorten(string? text, int max = MaxTarget)
    {
        var line = text?.ReplaceLineEndings(" ").Trim();
        if (string.IsNullOrEmpty(line))
        {
            return null;
        }

        return line.Length > max ? line[..(max - 1)] + "…" : line;
    }

    private static int Count(JsonElement? args, string key) =>
        args is { ValueKind: JsonValueKind.Object } value && value.TryGetProperty(key, out var array) && array.ValueKind == JsonValueKind.Array
            ? array.GetArrayLength()
            : 0;

    private static string? Property(JsonElement? args, string key) =>
        args is { ValueKind: JsonValueKind.Object } value && value.TryGetProperty(key, out var property) && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;

    private static JsonElement? Parse(string? json)
    {
        if (string.IsNullOrEmpty(json))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(json);
            return document.RootElement.Clone();
        }
        catch (JsonException)
        {
            return null;
        }
    }

    // MCP tools can arrive as `mcp__<server>__<tool>`.
    private static string BareName(string tool)
    {
        var last = tool.LastIndexOf("__", StringComparison.Ordinal);
        return tool.StartsWith("mcp__", StringComparison.Ordinal) && last > 4 ? tool[(last + 2)..] : tool;
    }

    private static Regex ApiPath(string route) =>
        new("^/api/" + Regex.Escape(route).Replace(@"\*", "[^/]+") + "$", RegexOptions.CultureInvariant);

    [GeneratedRegex("\"[^\"]*\"|'[^']*'|\\S+")]
    private static partial Regex Words();
}

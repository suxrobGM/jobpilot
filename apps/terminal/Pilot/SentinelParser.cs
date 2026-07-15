using System.Text;
using System.Text.RegularExpressions;

namespace JobPilot.Terminal.Pilot;

/// <summary>Terminal outcome of one Pilot cycle, reported by the skill's sentinel line.</summary>
public enum PilotCycleStatus
{
    Ok,
    Empty,
    Error,
}

/// <summary>A parsed <c>[[JOBPILOT_CYCLE ...]]</c> sentinel.</summary>
public readonly record struct PilotCycle(Guid CycleId, PilotCycleStatus Status, int SleepSeconds);

/// <summary>
/// Detects the Pilot cycle sentinel in raw PTY output. The TUI redraws with ANSI/CSI sequences and may echo
/// the line, so a rolling ANSI-stripped tail is rescanned each feed and every cycle id fires at most once.
/// </summary>
public sealed partial class SentinelParser
{
    // ~8KB tail: far larger than the ~70-char sentinel, so a match is never split by the window edge.
    private const int MaxTailChars = 8192;

    // > the max sentinels that fit in the tail, so an id never evicts before its match scrolls out (no refire).
    private const int MaxSeenIds = 256;

    private readonly StringBuilder tail = new();
    private readonly HashSet<Guid> seen = [];
    private readonly Queue<Guid> seenOrder = new();

    [GeneratedRegex(@"\[\[JOBPILOT_CYCLE cycle=([0-9a-fA-F-]{36}) status=(ok|empty|error) sleep=(\d+)\]\]")]
    private static partial Regex SentinelPattern();

    /// <summary>Feeds a raw output chunk and returns any newly detected cycles (usually none).</summary>
    public IReadOnlyList<PilotCycle> Feed(ReadOnlySpan<byte> chunk)
    {
        // The sentinel and ANSI framing are ASCII; a UTF-8 split only mangles surrounding non-ASCII text.
        tail.Append(Encoding.UTF8.GetString(chunk));
        if (tail.Length > MaxTailChars)
        {
            tail.Remove(0, tail.Length - MaxTailChars);
        }

        var stripped = StripControl(tail.ToString());

        List<PilotCycle>? cycles = null;
        foreach (Match match in SentinelPattern().Matches(stripped))
        {
            if (!Guid.TryParse(match.Groups[1].ValueSpan, out var cycleId) || !seen.Add(cycleId))
            {
                continue;
            }

            seenOrder.Enqueue(cycleId);
            if (seenOrder.Count > MaxSeenIds)
            {
                seen.Remove(seenOrder.Dequeue());
            }

            (cycles ??= []).Add(new PilotCycle(cycleId, ParseStatus(match.Groups[2].ValueSpan), ParseSleep(match.Groups[3].ValueSpan)));
        }

        return (IReadOnlyList<PilotCycle>?)cycles ?? [];
    }

    private static PilotCycleStatus ParseStatus(ReadOnlySpan<char> value) => value switch
    {
        "empty" => PilotCycleStatus.Empty,
        "error" => PilotCycleStatus.Error,
        _ => PilotCycleStatus.Ok,
    };

    // The conductor re-clamps; an overflowing count still caps at the ceiling rather than dropping the cycle.
    private static int ParseSleep(ReadOnlySpan<char> value) => int.TryParse(value, out var seconds) ? seconds : int.MaxValue;

    /// <summary>Removes ESC sequences (CSI/OSC and two-char escapes) and redraw control bytes, keeping newlines.</summary>
    private static string StripControl(ReadOnlySpan<char> input)
    {
        var output = new StringBuilder(input.Length);
        for (var i = 0; i < input.Length; i++)
        {
            var c = input[i];
            if (c == '\x1b')
            {
                i = SkipEscape(input, i);
                continue;
            }

            // \r/\b/\a/\0 come from in-place redraws; \n stays so unrelated lines cannot fuse into a false match.
            if (c is not ('\r' or '\b' or '\a' or '\0'))
            {
                output.Append(c);
            }
        }

        return output.ToString();
    }

    /// <summary>Returns the last index consumed by the escape sequence starting at <paramref name="i"/>.</summary>
    private static int SkipEscape(ReadOnlySpan<char> s, int i)
    {
        if (i + 1 >= s.Length)
        {
            return s.Length; // Incomplete at the tail edge; the raw tail replays it fully next feed.
        }

        var next = s[i + 1];
        if (next == '[')
        {
            var j = i + 2;
            while (j < s.Length && s[j] is < '@' or > '~')
            {
                j++;
            }
            return Math.Min(j, s.Length - 1);
        }

        if (next == ']')
        {
            var j = i + 2;
            while (j < s.Length && s[j] != '\a')
            {
                if (s[j] == '\x1b' && j + 1 < s.Length && s[j + 1] == '\\')
                {
                    return j + 1;
                }
                j++;
            }
            return Math.Min(j, s.Length - 1);
        }

        return i + 1;
    }
}

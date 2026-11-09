using System.Text;
using System.Text.RegularExpressions;

namespace JobPilot.Terminal.Pilot.Agent;

public enum StuckReason
{
    None,
    RepeatedOutput,
    ErrorLoop,
}

/// <summary>
/// Spots a stuck agent from its output well before the result timeout: one line repeating, or a burst of error
/// lines. The caller supplies <c>now</c>, so the thresholds are testable.
/// </summary>
public sealed partial class StuckDetector
{
    // The same line recurring this many times across the window is a wedged redraw loop.
    public const int RepeatThreshold = 6;
    private static readonly TimeSpan RepeatWindow = TimeSpan.FromMinutes(5);

    private const int ErrorThreshold = 5;
    private static readonly TimeSpan ErrorWindow = TimeSpan.FromMinutes(2);

    // A real retry loop repeats a few lines; varied narration or job text that merely mentions errors does not.
    private const int MaxDistinctErrorLines = 2;

    // A TUI diff-repaint can echo one on-screen error line many times in a burst; within this gap it counts once.
    private static readonly TimeSpan ErrorEchoGap = TimeSpan.FromSeconds(2);

    private const int MaxLineChars = 512;

    // A spinner redrawing via \r never emits '\n', so without a cap the unterminated residue grows forever.
    private const int MaxPendingChars = 8192;

    // Leading \b only, so "terror"/"mirrored" never count while suffixes still do ("errors", "ECONNABORTED").
    [GeneratedRegex(@"\b(error\w*|exception\w*|failed to|econn\w*|etimedout|timed? ?out)\b", RegexOptions.IgnoreCase)]
    private static partial Regex ErrorPattern();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespacePattern();

    // Feed runs on the PTY read thread and Reset on the pilot loop; a corrupted collection would kill the read loop.
    private readonly Lock sync = new();

    private readonly StringBuilder pending = new();
    private readonly Queue<(DateTimeOffset Time, string Line)> recentErrors = new();
    private string? lastLine;
    private int repeatCount;
    private DateTimeOffset repeatStart;
    private string? lastErrorLine;
    private DateTimeOffset lastErrorTime;

    /// <summary>Returns the first heuristic that fired on this chunk's complete lines, or <c>None</c>.</summary>
    public StuckReason Feed(ReadOnlySpan<byte> chunk, DateTimeOffset now)
    {
        var text = Encoding.UTF8.GetString(chunk);

        lock (sync)
        {
            pending.Append(text);
            var fired = StuckReason.None;
            if (text.Contains('\n'))
            {
                var lines = pending.ToString().Split('\n');
                pending.Clear().Append(lines[^1]);

                // Lines after the first fire still update the counters for the next feed.
                foreach (var raw in lines[..^1])
                {
                    var line = Normalize(raw);
                    if (line.Length == 0)
                    {
                        continue;
                    }

                    var reason = Observe(line, now);
                    if (fired == StuckReason.None)
                    {
                        fired = reason;
                    }
                }
            }

            if (pending.Length > MaxPendingChars)
            {
                pending.Remove(0, pending.Length - MaxPendingChars);
            }

            return fired;
        }
    }

    public void Reset()
    {
        lock (sync)
        {
            pending.Clear();
            recentErrors.Clear();
            lastLine = null;
            repeatCount = 0;
            lastErrorLine = null;
        }
    }

    private StuckReason Observe(string line, DateTimeOffset now)
    {
        if (ErrorPattern().IsMatch(line))
        {
            var echo = line == lastErrorLine && now - lastErrorTime < ErrorEchoGap;
            lastErrorLine = line;
            lastErrorTime = now;

            if (!echo)
            {
                recentErrors.Enqueue((now, line));
                while (now - recentErrors.Peek().Time > ErrorWindow)
                {
                    recentErrors.Dequeue();
                }

                var distinctLines = recentErrors.Select(e => e.Line).Distinct().Count();
                if (recentErrors.Count >= ErrorThreshold && distinctLines <= MaxDistinctErrorLines)
                {
                    // Re-arm: a second burst must re-accumulate before firing again.
                    recentErrors.Clear();
                    return StuckReason.ErrorLoop;
                }
            }
        }

        if (line == lastLine)
        {
            repeatCount++;
            if (repeatCount >= RepeatThreshold && now - repeatStart >= RepeatWindow)
            {
                // Re-arm from this occurrence so the next fire needs a fresh run.
                repeatCount = 1;
                repeatStart = now;
                return StuckReason.RepeatedOutput;
            }
        }
        else
        {
            lastLine = line;
            repeatCount = 1;
            repeatStart = now;
        }

        return StuckReason.None;
    }

    private static string Normalize(string line)
    {
        var stripped = Ansi.Strip(line);
        var builder = new StringBuilder(stripped.Length);
        foreach (var c in stripped)
        {
            // Control bytes become spaces, then collapse with the rest, so a redraw byte never splits a match.
            builder.Append(char.IsControl(c) ? ' ' : c);
        }

        var collapsed = WhitespacePattern().Replace(builder.ToString(), " ").Trim();
        return collapsed.Length > MaxLineChars ? collapsed[^MaxLineChars..] : collapsed;
    }
}

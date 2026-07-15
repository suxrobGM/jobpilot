using System.Text;
using System.Text.RegularExpressions;

namespace JobPilot.Terminal.Pilot;

/// <summary>Why a deterministic stall heuristic fired.</summary>
public enum PilotStallReason
{
    None,

    /// <summary>The same normalized output tail recurred past the threshold with no fresh output.</summary>
    RepeatedOutput,

    /// <summary>A burst of error-shaped lines with no intervening sentinel.</summary>
    ErrorLoop,
}

/// <summary>
/// Cheap, deterministic wedge detection fed the same PTY chunks as <see cref="SentinelParser"/>. Two signals fire
/// earlier than the 20-minute sentinel cap: an identical output line looping, or a burst of error-shaped lines.
/// Pure of PTY/timing details (the caller supplies <c>now</c>) so the thresholds are unit-testable.
/// </summary>
public sealed partial class StallDetector
{
    // The same normalized line recurring this many times across this window signals a wedged agent redraw loop.
    public const int RepeatThreshold = 6;
    public static readonly TimeSpan RepeatWindow = TimeSpan.FromMinutes(5);

    // A burst of this many error-shaped lines inside this window signals a retry/crash loop.
    public const int ErrorThreshold = 5;
    public static readonly TimeSpan ErrorWindow = TimeSpan.FromMinutes(2);

    // Cap the compared tail so a very long single line still matches its own repeats cheaply.
    private const int MaxLineChars = 512;

    [GeneratedRegex(@"error|exception|failed to|econn|timeout", RegexOptions.IgnoreCase)]
    private static partial Regex ErrorPattern();

    // CSI/OSC and two-char escapes; the rest of normalization collapses remaining whitespace.
    [GeneratedRegex(@"\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]")]
    private static partial Regex AnsiPattern();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespacePattern();

    private readonly StringBuilder pending = new();
    private readonly Queue<DateTimeOffset> errorTimes = new();
    private string? lastLine;
    private int repeatCount;
    private DateTimeOffset repeatStart;

    /// <summary>Feeds a raw output chunk; returns the first heuristic that fired this feed, or <c>None</c>.</summary>
    public PilotStallReason Feed(ReadOnlySpan<byte> chunk, DateTimeOffset now)
    {
        // ASCII sentinel/ANSI framing; a UTF-8 split only mangles surrounding non-ASCII, never the match.
        pending.Append(Encoding.UTF8.GetString(chunk));

        var fired = PilotStallReason.None;
        int newline;
        while ((newline = IndexOf(pending, '\n')) >= 0)
        {
            var raw = pending.ToString(0, newline);
            pending.Remove(0, newline + 1);

            var normalized = Normalize(raw);
            if (normalized.Length == 0)
            {
                continue;
            }

            var signal = Observe(normalized, now);
            if (signal != PilotStallReason.None && fired == PilotStallReason.None)
            {
                fired = signal; // Return the first crossing; residual lines still update counters for the next feed.
            }
        }

        return fired;
    }

    /// <summary>Clears all accumulated evidence; called on a fresh cycle and on a successful sentinel.</summary>
    public void Reset()
    {
        pending.Clear();
        errorTimes.Clear();
        lastLine = null;
        repeatCount = 0;
    }

    private PilotStallReason Observe(string line, DateTimeOffset now)
    {
        if (ErrorPattern().IsMatch(line))
        {
            errorTimes.Enqueue(now);
            while (errorTimes.Count > 0 && now - errorTimes.Peek() > ErrorWindow)
            {
                errorTimes.Dequeue();
            }

            if (errorTimes.Count >= ErrorThreshold)
            {
                errorTimes.Clear(); // Re-arm: a second burst must re-accumulate before firing again.
                return PilotStallReason.ErrorLoop;
            }
        }

        if (line == lastLine)
        {
            repeatCount++;
            if (repeatCount >= RepeatThreshold && now - repeatStart >= RepeatWindow)
            {
                repeatCount = 1; // Re-arm from this occurrence so the next fire needs a fresh run.
                repeatStart = now;
                return PilotStallReason.RepeatedOutput;
            }
        }
        else
        {
            lastLine = line;
            repeatCount = 1;
            repeatStart = now;
        }

        return PilotStallReason.None;
    }

    private static string Normalize(string line)
    {
        var stripped = AnsiPattern().Replace(line, string.Empty);
        var builder = new StringBuilder(stripped.Length);
        foreach (var c in stripped)
        {
            // Keep printable text and spaces; whitespace runs collapse next so redraw control bytes never split a match.
            builder.Append(char.IsControl(c) ? ' ' : c);
        }

        var collapsed = WhitespacePattern().Replace(builder.ToString(), " ").Trim();
        return collapsed.Length > MaxLineChars ? collapsed[^MaxLineChars..] : collapsed;
    }

    private static int IndexOf(StringBuilder builder, char value)
    {
        for (var i = 0; i < builder.Length; i++)
        {
            if (builder[i] == value)
            {
                return i;
            }
        }

        return -1;
    }
}

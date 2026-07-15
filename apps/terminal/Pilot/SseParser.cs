using System.Text;

namespace JobPilot.Terminal.Pilot;

/// <summary>One parsed SSE frame: its optional <c>event:</c> name and joined <c>data:</c> payload.</summary>
internal readonly record struct SseFrame(string? Event, string Data);

/// <summary>Exponential reconnect backoff: 5s doubling to a 5min cap. Pure so the schedule is unit-testable.</summary>
internal struct SseBackoff
{
    private int failures;

    public readonly TimeSpan Peek()
    {
        var seconds = Math.Min(
            PilotEventListener.InitialBackoff.TotalSeconds * Math.Pow(2, failures),
            PilotEventListener.MaxBackoff.TotalSeconds);
        return TimeSpan.FromSeconds(seconds);
    }

    public TimeSpan Next()
    {
        var delay = Peek();
        failures++;
        return delay;
    }

    public void Reset() => failures = 0;
}

/// <summary>
/// Incremental SSE frame parser. Buffers partial lines so a frame split across arbitrary read chunks still
/// dispatches on its terminating blank line; comment and unknown-field lines are ignored.
/// </summary>
internal sealed class SseParser
{
    private readonly StringBuilder line = new();
    private readonly StringBuilder data = new();
    private string? eventName;
    private bool hasFields;

    public IEnumerable<SseFrame> Feed(ReadOnlySpan<char> chunk)
    {
        List<SseFrame>? frames = null;
        foreach (var c in chunk)
        {
            if (c == '\n')
            {
                if (CompleteLine() is { } frame)
                {
                    (frames ??= []).Add(frame);
                }
            }
            else if (c != '\r') // CRLF and bare-LF both terminate on the \n; drop the CR.
            {
                line.Append(c);
            }
        }

        return (IEnumerable<SseFrame>?)frames ?? [];
    }

    private SseFrame? CompleteLine()
    {
        var text = line.ToString();
        line.Clear();

        if (text.Length == 0)
        {
            if (!hasFields)
            {
                return null; // Blank line with nothing buffered (e.g. between heartbeats).
            }

            var frame = new SseFrame(eventName, data.ToString());
            eventName = null;
            data.Clear();
            hasFields = false;
            return frame;
        }

        if (text[0] == ':')
        {
            return null; // Comment line.
        }

        var colon = text.IndexOf(':');
        var field = colon < 0 ? text : text[..colon];
        var value = colon < 0 ? string.Empty : text[(colon + 1)..];
        if (value.StartsWith(' '))
        {
            value = value[1..]; // A single leading space after the colon is stripped per the SSE spec.
        }

        switch (field)
        {
            case "event":
                eventName = value;
                hasFields = true;
                break;
            case "data":
                if (data.Length > 0)
                {
                    data.Append('\n');
                }
                data.Append(value);
                hasFields = true;
                break;
            case "id":
            case "retry":
                hasFields = true; // Tracked only so a lone id/retry still forms a frame; values are unused here.
                break;
            default:
                break; // Malformed or unknown field: ignore.
        }

        return null;
    }
}

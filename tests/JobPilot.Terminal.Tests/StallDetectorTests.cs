using System.Text;
using JobPilot.Terminal.Pilot;
using Xunit;

namespace JobPilot.Terminal.Tests;

public class StallDetectorTests
{
    private static readonly DateTimeOffset T0 = new(2026, 7, 15, 12, 0, 0, TimeSpan.Zero);

    private static byte[] Bytes(string text) => Encoding.UTF8.GetBytes(text);

    private static PilotStallReason FeedLine(StallDetector detector, string line, DateTimeOffset now) =>
        detector.Feed(Bytes(line + "\n"), now);

    [Fact]
    public void RepeatedOutput_FiresAtThreshold_AfterTheWindowElapses()
    {
        var detector = new StallDetector();
        var last = PilotStallReason.None;

        // Six identical lines spread across just over five minutes.
        for (var i = 0; i < StallDetector.RepeatThreshold; i++)
        {
            var now = T0 + TimeSpan.FromMinutes(i);
            last = FeedLine(detector, "waiting for network...", now);
        }

        Assert.Equal(PilotStallReason.RepeatedOutput, last);
    }

    [Fact]
    public void RepeatedOutput_DoesNotFire_BelowTheRepeatThreshold()
    {
        var detector = new StallDetector();

        for (var i = 0; i < StallDetector.RepeatThreshold - 1; i++)
        {
            var reason = FeedLine(detector, "same line", T0 + TimeSpan.FromMinutes(i));
            Assert.Equal(PilotStallReason.None, reason);
        }
    }

    [Fact]
    public void RepeatedOutput_DoesNotFire_WhenTheThresholdIsReachedTooQuickly()
    {
        var detector = new StallDetector();
        var last = PilotStallReason.None;

        // Six repeats within a couple of seconds: a fast redraw, not a five-minute wedge.
        for (var i = 0; i < StallDetector.RepeatThreshold + 2; i++)
        {
            last = FeedLine(detector, "spinner frame", T0 + TimeSpan.FromMilliseconds(200 * i));
        }

        Assert.Equal(PilotStallReason.None, last);
    }

    [Fact]
    public void RepeatedOutput_ResetsOnDistinctOutput()
    {
        var detector = new StallDetector();

        FeedLine(detector, "line A", T0);
        FeedLine(detector, "line A", T0 + TimeSpan.FromMinutes(1));
        FeedLine(detector, "line A", T0 + TimeSpan.FromMinutes(2));
        // Distinct output breaks the run; the counter and window restart here.
        FeedLine(detector, "line B", T0 + TimeSpan.FromMinutes(3));

        var last = PilotStallReason.None;
        for (var i = 0; i < StallDetector.RepeatThreshold; i++)
        {
            last = FeedLine(detector, "line A", T0 + TimeSpan.FromMinutes(4 + i));
        }

        Assert.Equal(PilotStallReason.RepeatedOutput, last);
    }

    [Fact]
    public void RepeatedOutput_NormalizesAnsiAndWhitespaceNoise()
    {
        var detector = new StallDetector();
        var last = PilotStallReason.None;

        // Each repeat carries different color/cursor CSI noise and spacing but the same underlying text.
        for (var i = 0; i < StallDetector.RepeatThreshold; i++)
        {
            var noisy = $"\x1b[2K\x1b[0m  Retrying   step\x1b[1m   \x1b[32m";
            last = FeedLine(detector, noisy, T0 + TimeSpan.FromMinutes(i));
        }

        Assert.Equal(PilotStallReason.RepeatedOutput, last);
    }

    [Fact]
    public void ErrorLoop_FiresOnFiveErrorHitsAcrossAtMostTwoLines()
    {
        var detector = new StallDetector();
        var last = PilotStallReason.None;

        // A real retry loop: two error lines alternating (a request that keeps refusing then timing out).
        string[] lines =
        [
            "Error: connect ECONNREFUSED",
            "request timeout after 30s",
            "Error: connect ECONNREFUSED",
            "request timeout after 30s",
            "Error: connect ECONNREFUSED",
        ];
        for (var i = 0; i < lines.Length; i++)
        {
            last = FeedLine(detector, lines[i], T0 + TimeSpan.FromSeconds(20 * i));
        }

        Assert.Equal(PilotStallReason.ErrorLoop, last);
    }

    [Fact]
    public void ErrorLoop_DoesNotFire_WhenFiveDistinctErrorLines()
    {
        var detector = new StallDetector();
        var last = PilotStallReason.None;

        // Five error-shaped but all-different lines: benign narration or varied job text, not a retry loop.
        string[] lines =
        [
            "Error: connect ECONNREFUSED",
            "Exception while loading",
            "failed to fetch page",
            "request timeout after 30s",
            "ERROR final straw",
        ];
        for (var i = 0; i < lines.Length; i++)
        {
            last = FeedLine(detector, lines[i], T0 + TimeSpan.FromSeconds(20 * i));
        }

        Assert.Equal(PilotStallReason.None, last);
    }

    [Fact]
    public void ErrorLoop_MatchesTimeoutAndEconnVariants_OnWordBoundaries()
    {
        var detector = new StallDetector();
        var last = PilotStallReason.None;

        // Two distinct lines exercising the timed-out / ETIMEDOUT variants; five hits across two lines fires.
        string[] lines =
        [
            "operation timed out",
            "socket ETIMEDOUT",
            "operation timed out",
            "socket ETIMEDOUT",
            "operation timed out",
        ];
        for (var i = 0; i < lines.Length; i++)
        {
            last = FeedLine(detector, lines[i], T0 + TimeSpan.FromSeconds(15 * i));
        }

        Assert.Equal(PilotStallReason.ErrorLoop, last);
    }

    [Fact]
    public void ErrorLoop_RequiresWholeWordMatch_NotSubstring()
    {
        var detector = new StallDetector();
        var last = PilotStallReason.None;

        // "terror"/"mirror" embed "error" as a substring but are not the word; the word-boundary regex ignores them.
        // Two lines alternating (never 6 in a row, so RepeatedOutput cannot fire either).
        string[] nearMisses = ["the terrorized queue", "mirrored the config again"];
        for (var i = 0; i < 6; i++)
        {
            last = FeedLine(detector, nearMisses[i % 2], T0 + TimeSpan.FromSeconds(10 * i));
        }

        Assert.Equal(PilotStallReason.None, last);
    }

    [Fact]
    public void ErrorLoop_DoesNotFire_WhenErrorsFallOutsideTheWindow()
    {
        var detector = new StallDetector();
        var last = PilotStallReason.None;

        // Five errors, but each is three minutes apart, so the 2-minute window never holds five at once.
        for (var i = 0; i < 5; i++)
        {
            last = FeedLine(detector, "failed to connect", T0 + TimeSpan.FromMinutes(3 * i));
        }

        Assert.Equal(PilotStallReason.None, last);
    }

    [Fact]
    public void ErrorLoop_IgnoresNonErrorLines()
    {
        var detector = new StallDetector();

        for (var i = 0; i < 10; i++)
        {
            var reason = FeedLine(detector, $"processing item {i}", T0 + TimeSpan.FromSeconds(i));
            Assert.Equal(PilotStallReason.None, reason);
        }
    }

    [Fact]
    public void Feed_HandlesLinesSplitAcrossChunks()
    {
        var detector = new StallDetector();
        var last = PilotStallReason.None;

        for (var i = 0; i < StallDetector.RepeatThreshold; i++)
        {
            var now = T0 + TimeSpan.FromMinutes(i);
            detector.Feed(Bytes("stuck on the "), now);       // first half, no newline yet
            last = detector.Feed(Bytes("very same step\n"), now); // completes the line
        }

        Assert.Equal(PilotStallReason.RepeatedOutput, last);
    }

    [Fact]
    public void Feed_CapsNewlineFreeResidue_AndStillDetectsLaterLines()
    {
        var detector = new StallDetector();

        // A spinner redrawing via \r never emits '\n'; the residue must cap instead of growing by megabytes.
        var frame = new string('x', 4096) + "\r";
        for (var i = 0; i < 600; i++)
        {
            var reason = detector.Feed(Bytes(frame), T0 + TimeSpan.FromSeconds(i));
            Assert.Equal(PilotStallReason.None, reason);
        }

        var last = PilotStallReason.None;
        for (var i = 0; i < StallDetector.RepeatThreshold; i++)
        {
            last = FeedLine(detector, "\nwaiting for network...", T0 + TimeSpan.FromMinutes(20 + i));
        }

        Assert.Equal(PilotStallReason.RepeatedOutput, last);
    }

    [Fact]
    public void Reset_ClearsAccumulatedEvidence()
    {
        var detector = new StallDetector();

        for (var i = 0; i < 4; i++)
        {
            FeedLine(detector, "failed to connect", T0 + TimeSpan.FromSeconds(10 * i));
        }

        detector.Reset(); // A successful sentinel wipes the burst.

        var reason = FeedLine(detector, "failed to connect", T0 + TimeSpan.FromSeconds(50));
        Assert.Equal(PilotStallReason.None, reason);
    }

    [Fact]
    public void ErrorLoop_ReArmsAfterFiring()
    {
        var detector = new StallDetector();

        PilotStallReason first = PilotStallReason.None;
        for (var i = 0; i < 5; i++)
        {
            first = FeedLine(detector, "connection timeout", T0 + TimeSpan.FromSeconds(10 * i));
        }
        Assert.Equal(PilotStallReason.ErrorLoop, first);

        // Immediately after firing it must re-accumulate: a single further error does not re-fire.
        var next = FeedLine(detector, "connection timeout", T0 + TimeSpan.FromSeconds(60));
        Assert.Equal(PilotStallReason.None, next);
    }
}

using System.Text;
using JobPilot.Terminal.Pilot.Stuck;
using Xunit;

namespace JobPilot.Terminal.Tests.Pilot.Stuck;

public class StuckDetectorTests
{
    private static readonly DateTimeOffset T0 = new(2026, 7, 15, 12, 0, 0, TimeSpan.Zero);

    private static byte[] Bytes(string text) => Encoding.UTF8.GetBytes(text);

    private static StuckReason FeedLine(StuckDetector detector, string line, DateTimeOffset now) =>
        detector.Feed(Bytes(line + "\n"), now);

    /// <summary>Feeds each line <paramref name="spacing"/> apart, cycling through <paramref name="lines"/>; returns the last result.</summary>
    private static StuckReason Feed(StuckDetector detector, int count, TimeSpan spacing, params string[] lines)
    {
        var last = StuckReason.None;
        for (var i = 0; i < count; i++)
        {
            last = FeedLine(detector, lines[i % lines.Length], T0 + (spacing * i));
        }

        return last;
    }

    [Fact]
    public void RepeatedOutput_Fires_WhenOneLineRepeatsAcrossTheWindow()
    {
        var reason = Feed(new StuckDetector(), StuckDetector.RepeatThreshold, TimeSpan.FromMinutes(1), "waiting for network...");

        Assert.Equal(StuckReason.RepeatedOutput, reason);
    }

    [Fact]
    public void RepeatedOutput_DoesNotFire_BelowTheThresholdOrWithinAFastRedraw()
    {
        Assert.Equal(
            StuckReason.None,
            Feed(new StuckDetector(), StuckDetector.RepeatThreshold - 1, TimeSpan.FromMinutes(1), "same line"));
        Assert.Equal(
            StuckReason.None,
            Feed(new StuckDetector(), StuckDetector.RepeatThreshold + 2, TimeSpan.FromMilliseconds(200), "spinner frame"));
    }

    [Fact]
    public void RepeatedOutput_RestartsTheCount_OnDistinctOutput()
    {
        var detector = new StuckDetector();
        Feed(detector, 3, TimeSpan.FromMinutes(1), "line A");
        FeedLine(detector, "line B", T0 + TimeSpan.FromMinutes(3));

        var last = StuckReason.None;
        for (var i = 0; i < StuckDetector.RepeatThreshold; i++)
        {
            last = FeedLine(detector, "line A", T0 + TimeSpan.FromMinutes(4 + i));
        }

        Assert.Equal(StuckReason.RepeatedOutput, last);
    }

    [Fact]
    public void RepeatedOutput_IgnoresAnsiAndWhitespaceNoise()
    {
        var reason = Feed(
            new StuckDetector(),
            StuckDetector.RepeatThreshold,
            TimeSpan.FromMinutes(1),
            "\x1b[2K\x1b[0m  Retrying   step\x1b[1m   \x1b[32m",
            "Retrying step");

        Assert.Equal(StuckReason.RepeatedOutput, reason);
    }

    [Theory]
    [InlineData("Error: connect ECONNREFUSED", "request timeout after 30s")]
    [InlineData("operation timed out", "socket ETIMEDOUT")]
    public void ErrorLoop_Fires_OnFiveErrorsAcrossAtMostTwoLines(string first, string second)
    {
        Assert.Equal(StuckReason.ErrorLoop, Feed(new StuckDetector(), 5, TimeSpan.FromSeconds(20), first, second));
    }

    [Fact]
    public void ErrorLoop_DoesNotFire_OnARepaintBurstOfOneLine()
    {
        // Twenty repaints of one on-screen line within a fraction of a second collapse to one error.
        var reason = Feed(new StuckDetector(), 20, TimeSpan.FromMilliseconds(10), "Error: connect ECONNREFUSED");

        Assert.Equal(StuckReason.None, reason);
    }

    [Fact]
    public void ErrorLoop_DoesNotFire_OnFiveDifferentErrorLines()
    {
        // Varied error-shaped narration or job text, not a retry loop.
        var reason = Feed(
            new StuckDetector(),
            5,
            TimeSpan.FromSeconds(20),
            "Error: connect ECONNREFUSED",
            "Exception while loading",
            "failed to fetch page",
            "request timeout after 30s",
            "ERROR final straw");

        Assert.Equal(StuckReason.None, reason);
    }

    [Fact]
    public void ErrorLoop_IgnoresLinesThatOnlyContainErrorInsideAWord()
    {
        // Alternating, so RepeatedOutput cannot fire either.
        var reason = Feed(new StuckDetector(), 10, TimeSpan.FromSeconds(10), "the terrorized queue", "mirrored the config again");

        Assert.Equal(StuckReason.None, reason);
    }

    [Fact]
    public void ErrorLoop_DoesNotFire_WhenErrorsFallOutsideTheWindow()
    {
        Assert.Equal(StuckReason.None, Feed(new StuckDetector(), 5, TimeSpan.FromMinutes(3), "failed to connect"));
    }

    [Fact]
    public void ErrorLoop_NeedsAFreshBurst_AfterFiringOrAReset()
    {
        var fired = new StuckDetector();
        Assert.Equal(StuckReason.ErrorLoop, Feed(fired, 5, TimeSpan.FromSeconds(10), "connection timeout"));
        Assert.Equal(StuckReason.None, FeedLine(fired, "connection timeout", T0 + TimeSpan.FromSeconds(60)));

        var reset = new StuckDetector();
        Feed(reset, 4, TimeSpan.FromSeconds(10), "failed to connect");
        reset.Reset();
        Assert.Equal(StuckReason.None, FeedLine(reset, "failed to connect", T0 + TimeSpan.FromSeconds(50)));
    }

    [Fact]
    public void Feed_JoinsALineSplitAcrossChunks()
    {
        var detector = new StuckDetector();
        var last = StuckReason.None;

        for (var i = 0; i < StuckDetector.RepeatThreshold; i++)
        {
            var now = T0 + TimeSpan.FromMinutes(i);
            detector.Feed(Bytes("stuck on the "), now);
            last = detector.Feed(Bytes("very same step\n"), now);
        }

        Assert.Equal(StuckReason.RepeatedOutput, last);
    }

    [Fact]
    public void Feed_CapsNewlineFreeResidue_AndStillDetectsLaterLines()
    {
        var detector = new StuckDetector();

        // A spinner redrawing via \r never emits '\n'; the residue must cap instead of growing by megabytes.
        var frame = new string('x', 4096) + "\r";
        for (var i = 0; i < 600; i++)
        {
            Assert.Equal(StuckReason.None, detector.Feed(Bytes(frame), T0 + TimeSpan.FromSeconds(i)));
        }

        var last = StuckReason.None;
        for (var i = 0; i < StuckDetector.RepeatThreshold; i++)
        {
            last = FeedLine(detector, "\nwaiting for network...", T0 + TimeSpan.FromMinutes(20 + i));
        }

        Assert.Equal(StuckReason.RepeatedOutput, last);
    }
}

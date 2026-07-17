using JobPilot.Terminal.Pilot;
using Xunit;

namespace JobPilot.Terminal.Tests;

/// <summary>Covers SseParser and SseBackoff, which share Pilot/SseParser.cs.</summary>
public sealed class SseParserTests
{
    private static List<SseFrame> FeedAll(SseParser parser, params string[] chunks)
    {
        var frames = new List<SseFrame>();
        foreach (var chunk in chunks)
        {
            frames.AddRange(parser.Feed(chunk));
        }
        return frames;
    }

    [Fact]
    public void DispatchesAFrameOnTheBlankLine()
    {
        var parser = new SseParser();

        var frames = FeedAll(parser, "event: connected\n\n");

        var frame = Assert.Single(frames);
        Assert.Equal("connected", frame.Event);
        Assert.Equal(string.Empty, frame.Data);
    }

    [Fact]
    public void AssemblesAFrameSplitAcrossChunks()
    {
        var parser = new SseParser();

        // The frame is delivered a few characters at a time, splitting mid-field and mid-value.
        var frames = FeedAll(parser, "da", "ta: {\"type\":\"sta", "te.changed\"}", "\n", "\n");

        var frame = Assert.Single(frames);
        Assert.Equal("{\"type\":\"state.changed\"}", frame.Data);
    }

    [Fact]
    public void JoinsMultipleDataLines()
    {
        var parser = new SseParser();

        var frames = FeedAll(parser, "data: line1\ndata: line2\n\n");

        var frame = Assert.Single(frames);
        Assert.Equal("line1\nline2", frame.Data);
    }

    [Fact]
    public void HandlesCarriageReturnLineEndings()
    {
        var parser = new SseParser();

        var frames = FeedAll(parser, "id: 7\r\ndata: hi\r\n\r\n");

        var frame = Assert.Single(frames);
        Assert.Equal("hi", frame.Data);
    }

    [Fact]
    public void IgnoresCommentAndMalformedLines()
    {
        var parser = new SseParser();

        // A comment line, then a field-less malformed line, then a real data field.
        var frames = FeedAll(parser, ": keep-alive\ngarbage-without-colon\ndata: ok\n\n");

        var frame = Assert.Single(frames);
        Assert.Equal("ok", frame.Data);
    }

    [Fact]
    public void EmitsNothingForBareHeartbeatBlankLines()
    {
        var parser = new SseParser();

        Assert.Empty(FeedAll(parser, "\n\n\n"));
    }

    [Fact]
    public void Backoff_DoublesFromFiveSecondsToFiveMinuteCap()
    {
        var backoff = new SseBackoff();

        Assert.Equal(TimeSpan.FromSeconds(5), backoff.Next());
        Assert.Equal(TimeSpan.FromSeconds(10), backoff.Next());
        Assert.Equal(TimeSpan.FromSeconds(20), backoff.Next());
        Assert.Equal(TimeSpan.FromSeconds(40), backoff.Next());
        Assert.Equal(TimeSpan.FromSeconds(80), backoff.Next());
        Assert.Equal(TimeSpan.FromSeconds(160), backoff.Next());
        Assert.Equal(TimeSpan.FromMinutes(5), backoff.Next()); // 320s clamps to the 300s cap
        Assert.Equal(TimeSpan.FromMinutes(5), backoff.Next()); // stays capped
    }

    [Fact]
    public void Backoff_ResetsToFiveSeconds()
    {
        var backoff = new SseBackoff();
        backoff.Next();
        backoff.Next();

        backoff.Reset();

        Assert.Equal(TimeSpan.FromSeconds(5), backoff.Next());
    }
}

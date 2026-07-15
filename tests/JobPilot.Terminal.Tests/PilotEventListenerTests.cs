using System.Net;
using System.Text;
using System.Threading.Channels;
using JobPilot.Terminal.Pilot;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests;

public sealed class PilotEventListenerTests
{
    // --- SseParser: frame assembly across arbitrary chunk boundaries ---

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
    public void SseParser_DispatchesAFrameOnTheBlankLine()
    {
        var parser = new SseParser();

        var frames = FeedAll(parser, "event: connected\n\n");

        var frame = Assert.Single(frames);
        Assert.Equal("connected", frame.Event);
        Assert.Equal(string.Empty, frame.Data);
    }

    [Fact]
    public void SseParser_AssemblesAFrameSplitAcrossChunks()
    {
        var parser = new SseParser();

        // The frame is delivered a few characters at a time, splitting mid-field and mid-value.
        var frames = FeedAll(parser, "da", "ta: {\"type\":\"sta", "te.changed\"}", "\n", "\n");

        var frame = Assert.Single(frames);
        Assert.Equal("{\"type\":\"state.changed\"}", frame.Data);
    }

    [Fact]
    public void SseParser_JoinsMultipleDataLines()
    {
        var parser = new SseParser();

        var frames = FeedAll(parser, "data: line1\ndata: line2\n\n");

        var frame = Assert.Single(frames);
        Assert.Equal("line1\nline2", frame.Data);
    }

    [Fact]
    public void SseParser_HandlesCarriageReturnLineEndings()
    {
        var parser = new SseParser();

        var frames = FeedAll(parser, "id: 7\r\ndata: hi\r\n\r\n");

        var frame = Assert.Single(frames);
        Assert.Equal("hi", frame.Data);
    }

    [Fact]
    public void SseParser_IgnoresCommentAndMalformedLines()
    {
        var parser = new SseParser();

        // A comment line, then a field-less malformed line, then a real data field.
        var frames = FeedAll(parser, ": keep-alive\ngarbage-without-colon\ndata: ok\n\n");

        var frame = Assert.Single(frames);
        Assert.Equal("ok", frame.Data);
    }

    [Fact]
    public void SseParser_EmitsNothingForBareHeartbeatBlankLines()
    {
        var parser = new SseParser();

        Assert.Empty(FeedAll(parser, "\n\n\n"));
    }

    // --- ShouldWake: which events wake the conductor ---

    private static SseFrame Frame(string data, string? name = null) => new(name, data);

    [Fact]
    public void ShouldWake_OnEscalationAnswered()
    {
        Assert.True(PilotEventListener.ShouldWake(Frame("{\"type\":\"escalation.answered\",\"escalation\":{}}")));
    }

    [Fact]
    public void ShouldWake_OnStateChanged()
    {
        Assert.True(PilotEventListener.ShouldWake(Frame("{\"type\":\"state.changed\",\"state\":{}}")));
    }

    [Fact]
    public void ShouldWake_OnApprovedPromotionUpdate()
    {
        Assert.True(PilotEventListener.ShouldWake(
            Frame("{\"type\":\"promotion.updated\",\"promotion\":{\"status\":\"approved\"}}")));
    }

    [Fact]
    public void ShouldNotWake_OnNonApprovedPromotionUpdate()
    {
        Assert.False(PilotEventListener.ShouldWake(
            Frame("{\"type\":\"promotion.updated\",\"promotion\":{\"status\":\"draft\"}}")));
    }

    [Theory]
    [InlineData("{\"type\":\"journal.appended\",\"entry\":{}}")]
    [InlineData("{\"type\":\"escalation.created\",\"escalation\":{}}")]
    [InlineData("{\"type\":\"promotion.created\",\"promotion\":{\"status\":\"draft\"}}")]
    public void ShouldNotWake_OnUnrelatedEvents(string data)
    {
        Assert.False(PilotEventListener.ShouldWake(Frame(data)));
    }

    [Fact]
    public void ShouldNotWake_OnControlFramesWithNoData()
    {
        Assert.False(PilotEventListener.ShouldWake(Frame(string.Empty, "connected")));
        Assert.False(PilotEventListener.ShouldWake(Frame(string.Empty, "ping")));
    }

    [Fact]
    public void ShouldNotWake_OnMalformedJson()
    {
        Assert.False(PilotEventListener.ShouldWake(Frame("{not json")));
    }

    // --- ShouldConnect: connect only when enabled, paired, and addressable ---

    private static PilotPairing Pairing(bool enabled = true, string apiUrl = "https://api") => new()
    {
        Provider = "claude",
        ApiToken = "tok",
        ApiUrl = apiUrl,
        WebUrl = "https://web",
        Enabled = enabled,
    };

    [Fact]
    public void ShouldConnect_OnlyWhenEnabledPairedAndAddressable()
    {
        Assert.True(PilotEventListener.ShouldConnect(Pairing()));
        Assert.False(PilotEventListener.ShouldConnect(null));
        Assert.False(PilotEventListener.ShouldConnect(Pairing(enabled: false)));
        Assert.False(PilotEventListener.ShouldConnect(Pairing(apiUrl: "")));
    }

    // --- SseBackoff: 5s doubling to a 5min cap, reset on a good connection ---

    [Fact]
    public void SseBackoff_DoublesFromFiveSecondsToFiveMinuteCap()
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
    public void SseBackoff_ResetsToFiveSeconds()
    {
        var backoff = new SseBackoff();
        backoff.Next();
        backoff.Next();

        backoff.Reset();

        Assert.Equal(TimeSpan.FromSeconds(5), backoff.Next());
    }

    // --- End-to-end: connect, wake on a domain event, tear down on disable ---

    private static async Task WaitUntil(Func<bool> condition)
    {
        for (var i = 0; i < 200 && !condition(); i++)
        {
            await Task.Delay(10);
        }
        Assert.True(condition(), "condition was not met within the timeout");
    }

    private static (PilotEventListener listener, PilotConductor conductor, PilotStore store, TempDir temp)
        BuildListener(FakeSseHandler handler)
    {
        var temp = new TempDir();
        var store = new PilotStore(Path.Combine(temp.Root, ".jobpilot", "pilot.json"), NullLogger<PilotStore>.Instance);
        var conductor = new PilotConductor(store, new FakePilotEnvironment(), NullLogger<PilotConductor>.Instance);
        var listener = new PilotEventListener(store, conductor, NullLogger<PilotEventListener>.Instance, new HttpClient(handler));
        return (listener, conductor, store, temp);
    }

    [Fact]
    public async Task Listener_ConnectsAndWakesTheConductor_OnAWakeWorthyEvent()
    {
        var handler = new FakeSseHandler();
        var (listener, conductor, store, temp) = BuildListener(handler);
        store.Save(Pairing());

        await listener.StartAsync(CancellationToken.None);
        handler.Stream.Push("event: connected\n\n");
        await WaitUntil(() => listener.Connected);

        Assert.True(conductor.BuildStatus().Connected);
        var wakesBefore = conductor.WakeCount;

        handler.Stream.Push("data: {\"type\":\"escalation.answered\",\"escalation\":{}}\n\n");
        await WaitUntil(() => conductor.WakeCount > wakesBefore);

        Assert.Equal("Bearer tok", handler.LastRequest?.Headers.Authorization?.ToString());
        Assert.Contains("text/event-stream", handler.LastRequest?.Headers.Accept.ToString());

        await listener.StopAsync(CancellationToken.None);
        listener.Dispose();
        temp.Dispose();
    }

    [Fact]
    public async Task Listener_DoesNotWake_OnAControlFrame()
    {
        var handler = new FakeSseHandler();
        var (listener, conductor, store, temp) = BuildListener(handler);
        store.Save(Pairing());

        await listener.StartAsync(CancellationToken.None);
        handler.Stream.Push("event: connected\n\n");
        await WaitUntil(() => listener.Connected);
        var wakes = conductor.WakeCount;

        handler.Stream.Push("event: ping\n\n");
        await Task.Delay(50);

        Assert.Equal(wakes, conductor.WakeCount);

        await listener.StopAsync(CancellationToken.None);
        listener.Dispose();
        temp.Dispose();
    }

    [Fact]
    public async Task Listener_TearsDown_WhenThePilotIsDisabled()
    {
        var handler = new FakeSseHandler();
        var (listener, conductor, store, temp) = BuildListener(handler);
        store.Save(Pairing());

        await listener.StartAsync(CancellationToken.None);
        handler.Stream.Push("event: connected\n\n");
        await WaitUntil(() => listener.Connected);

        store.SetEnabled(false);
        // A heartbeat unblocks the read so the listener re-checks the pairing and tears down.
        handler.Stream.Push("event: ping\n\n");

        await WaitUntil(() => !listener.Connected);
        Assert.False(conductor.BuildStatus().Connected);

        await listener.StopAsync(CancellationToken.None);
        listener.Dispose();
        temp.Dispose();
    }

    [Fact]
    public async Task Listener_StaysDisconnected_OnARejectedStream()
    {
        var handler = new FakeSseHandler { Status = HttpStatusCode.Unauthorized };
        var (listener, conductor, store, temp) = BuildListener(handler);
        store.Save(Pairing());

        await listener.StartAsync(CancellationToken.None);
        await WaitUntil(() => handler.Calls > 0);
        await Task.Delay(50);

        Assert.False(listener.Connected);

        await listener.StopAsync(CancellationToken.None);
        listener.Dispose();
        temp.Dispose();
    }

    /// <summary>An HttpMessageHandler that serves one controllable SSE stream and records the request.</summary>
    private sealed class FakeSseHandler : HttpMessageHandler
    {
        public FakeSseStream Stream { get; } = new();
        public HttpStatusCode Status { get; init; } = HttpStatusCode.OK;
        public int Calls { get; private set; }
        public HttpRequestMessage? LastRequest { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;
            LastRequest = request;
            var response = new HttpResponseMessage(Status);
            if (Status == HttpStatusCode.OK)
            {
                response.Content = new StreamContent(Stream);
                response.Content.Headers.ContentType = new("text/event-stream");
            }
            else
            {
                response.Content = new StringContent(string.Empty);
            }
            return Task.FromResult(response);
        }
    }

    /// <summary>A read-only stream fed on demand, so a test can push SSE frames and hold the connection open.</summary>
    private sealed class FakeSseStream : Stream
    {
        private readonly Channel<byte[]> chunks = Channel.CreateUnbounded<byte[]>();
        private byte[]? current;
        private int offset;

        public void Push(string text) => chunks.Writer.TryWrite(Encoding.UTF8.GetBytes(text));

        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            while (current is null || offset >= current.Length)
            {
                if (!await chunks.Reader.WaitToReadAsync(cancellationToken))
                {
                    return 0;
                }
                chunks.Reader.TryRead(out current);
                offset = 0;
            }

            var count = Math.Min(buffer.Length, current!.Length - offset);
            current.AsMemory(offset, count).CopyTo(buffer);
            offset += count;
            return count;
        }

        public override int Read(byte[] buffer, int offset, int count) =>
            ReadAsync(buffer.AsMemory(offset, count)).AsTask().GetAwaiter().GetResult();

        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override void Flush() { }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}

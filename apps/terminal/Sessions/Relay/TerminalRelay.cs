using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;

namespace JobPilot.Terminal.Sessions.Relay;

/// <summary>Relays session output to every browser WebSocket and browser input back to the session.</summary>
public sealed class TerminalRelay : IDisposable
{
    // Disconnect clients that fall this far behind rather than dropping bytes and corrupting the screen.
    private const int OutboxCapacity = 1024;
    private const int MaxMessageBytes = 1024 * 1024;
    private const int ReplayCapacityBytes = 512 * 1024;

    private readonly TerminalSession session;
    private readonly ILogger<TerminalRelay> logger;

    // Orders replay writes against client registration, so a new client sees no gap and no duplicate.
    private readonly Lock sync = new();
    private readonly Dictionary<WebSocket, Channel<byte[]>> clients = [];
    private readonly ReplayBuffer replay = new(ReplayCapacityBytes);

    public TerminalRelay(TerminalSession session, ILogger<TerminalRelay> logger)
    {
        this.session = session;
        this.logger = logger;

        session.Output += Broadcast;
        session.Exited += OnSessionExited;
        session.Starting += OnSessionStarting;
    }

    /// <summary>Serves one WebSocket until it closes.</summary>
    public async Task ServeAsync(WebSocket socket, CancellationToken ct)
    {
        var outbox = Channel.CreateBounded<byte[]>(new BoundedChannelOptions(OutboxCapacity)
        {
            SingleReader = true,
            FullMode = BoundedChannelFullMode.Wait, // so TryWrite fails when full instead of dropping bytes
        });

        lock (sync)
        {
            foreach (var chunk in replay.Chunks)
            {
                outbox.Writer.TryWrite(chunk);
            }

            clients[socket] = outbox;
        }

        logger.LogInformation("WebSocket client connected.");

        using var connectionEnded = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var sender = SendLoopAsync(socket, outbox, connectionEnded.Token);
        try
        {
            await WebSocketTextReader.ReadAsync(socket, MaxMessageBytes, Dispatch, logger, ct);
        }
        finally
        {
            Unregister(socket);
            await connectionEnded.CancelAsync();
            await sender;
            logger.LogInformation("WebSocket client disconnected.");
        }
    }

    /// <summary>Aborts every client so an open socket cannot stall host shutdown.</summary>
    public void AbortAll()
    {
        foreach (var socket in Snapshot())
        {
            Drop(socket);
        }
    }

    public void Dispose()
    {
        session.Output -= Broadcast;
        session.Exited -= OnSessionExited;
        session.Starting -= OnSessionStarting;

        foreach (var socket in Snapshot())
        {
            Unregister(socket);
        }
    }

    internal static string? ExitBanner(SessionExit exit) => exit.Requested
        ? null
        : $"\r\n\e[31m[JobPilot.Terminal] {exit.ProviderDisplayName} exited with code {exit.ExitCode}. Use Restart to reopen.\e[0m\r\n";

    private void Broadcast(byte[] data)
    {
        List<WebSocket>? lagging = null;
        lock (sync)
        {
            replay.Append(data);
            foreach (var (socket, outbox) in clients)
            {
                if (!outbox.Writer.TryWrite(data))
                {
                    (lagging ??= []).Add(socket);
                }
            }
        }

        // Outside the lock: tearing down a socket must not stall the PTY reader or new connections.
        foreach (var socket in lagging ?? [])
        {
            logger.LogWarning("Dropping a WebSocket client that fell {Capacity} chunks behind.", OutboxCapacity);
            Drop(socket);
        }
    }

    private void OnSessionStarting()
    {
        lock (sync)
        {
            replay.Clear();
        }
    }

    private void OnSessionExited(SessionExit exit)
    {
        if (ExitBanner(exit) is { } banner)
        {
            Broadcast(Encoding.UTF8.GetBytes(banner));
        }
    }

    private WebSocket[] Snapshot()
    {
        lock (sync)
        {
            return [.. clients.Keys];
        }
    }

    private void Drop(WebSocket socket)
    {
        Unregister(socket);
        socket.Abort();
    }

    private void Unregister(WebSocket socket)
    {
        Channel<byte[]>? outbox;
        lock (sync)
        {
            clients.Remove(socket, out outbox);
        }

        outbox?.Writer.TryComplete();
    }

    private async Task SendLoopAsync(WebSocket socket, Channel<byte[]> outbox, CancellationToken ct)
    {
        try
        {
            await foreach (var chunk in outbox.Reader.ReadAllAsync(ct))
            {
                if (socket.State != WebSocketState.Open)
                {
                    return;
                }

                await socket.SendAsync(chunk, WebSocketMessageType.Binary, endOfMessage: true, ct);
            }
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Send to a WebSocket client failed; dropping it.");
        }
    }

    private void Dispatch(ReadOnlySpan<byte> utf8Json)
    {
        BrowserMessage? message;
        try
        {
            message = JsonSerializer.Deserialize(utf8Json, AppJsonContext.Default.BrowserMessage);
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Ignoring a malformed WebSocket message.");
            return;
        }

        switch (message?.Type)
        {
            case "input":
                if (DecodeInput(message.Data) is { } bytes)
                {
                    if (!BrowserMessage.IsFocusReport(bytes))
                    {
                        session.MarkUserInput();
                    }

                    session.Write(bytes);
                }

                break;

            case "resize":
                if (message.Cols is { } cols && message.Rows is { } rows && Viewport.IsValid(cols, rows))
                {
                    session.Resize(cols, rows);
                }
                else
                {
                    logger.LogWarning("Ignoring a resize with cols={Cols} rows={Rows}.", message.Cols, message.Rows);
                }

                break;
        }
    }

    private byte[]? DecodeInput(string? data)
    {
        if (string.IsNullOrEmpty(data))
        {
            return null;
        }

        try
        {
            return Convert.FromBase64String(data);
        }
        catch (FormatException ex)
        {
            logger.LogWarning(ex, "Ignoring WebSocket input that is not valid base64.");
            return null;
        }
    }
}

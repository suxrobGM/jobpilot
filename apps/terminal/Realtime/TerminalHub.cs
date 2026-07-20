using System.Buffers;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;
using JobPilot.Terminal.Contracts;
using JobPilot.Terminal.Sessions;

namespace JobPilot.Terminal.Realtime;

/// <summary>Bridges browser WebSockets and the terminal session.</summary>
public sealed class TerminalHub : IDisposable
{
    // Disconnect clients that fall this far behind rather than corrupting the stream.
    private const int OutboxCapacity = 1024;

    private const int ReceiveBufferSize = 8192;

    private const int MaxMessageBytes = 1024 * 1024;

    private const int ReplayCapacityBytes = 512 * 1024;

    private readonly SessionManager session;
    private readonly ILogger<TerminalHub> logger;

    // Guards the client registry and replay buffer, ordering registration against broadcasts (no gap, no duplication).
    private readonly Lock replayLock = new();
    private readonly Dictionary<WebSocket, Channel<byte[]>> clients = [];
    private readonly ReplayBuffer replay = new(ReplayCapacityBytes);

    public TerminalHub(SessionManager session, ILogger<TerminalHub> logger)
    {
        this.session = session;
        this.logger = logger;

        session.Output += Broadcast;
        session.Exited += OnSessionExited;
        session.Starting += OnSessionStarting;
    }

    /// <summary>Serves one terminal WebSocket connection until it closes.</summary>
    public async Task ServeConnectionAsync(WebSocket socket, CancellationToken ct)
    {
        // Wait mode makes TryWrite fail when full; dropping terminal bytes would corrupt the screen.
        var outbox = Channel.CreateBounded<byte[]>(new BoundedChannelOptions(OutboxCapacity)
        {
            SingleReader = true,
            SingleWriter = false,
            FullMode = BoundedChannelFullMode.Wait,
        });

        lock (replayLock)
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
            await ReceiveLoopAsync(socket, ct);
        }
        finally
        {
            Unregister(socket);
            await connectionEnded.CancelAsync();
            await sender; // never faults; SendLoopAsync swallows its own transport errors
            logger.LogInformation("WebSocket client disconnected.");
        }
    }

    /// <summary>Buffers output for replay and queues it for every connected client.</summary>
    private void Broadcast(byte[] data)
    {
        List<WebSocket>? lagging = null;
        lock (replayLock)
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

        // Abort outside the lock: tearing down a socket must not stall the PTY reader or new connections.
        if (lagging is null)
        {
            return;
        }
        foreach (var socket in lagging)
        {
            logger.LogWarning("Dropping a WebSocket client that fell {Capacity} chunks behind.", OutboxCapacity);
            Drop(socket);
        }
    }

    /// <summary>Aborts every client so an open socket cannot stall host shutdown.</summary>
    public void AbortAll()
    {
        foreach (var socket in SnapshotClients())
        {
            Drop(socket);
        }
    }

    private WebSocket[] SnapshotClients()
    {
        lock (replayLock)
        {
            return [.. clients.Keys];
        }
    }

    private void Drop(WebSocket socket)
    {
        Unregister(socket);
        socket.Abort();
    }

    private void OnSessionStarting()
    {
        lock (replayLock)
        {
            replay.Clear();
        }
    }

    private void Unregister(WebSocket socket)
    {
        Channel<byte[]>? outbox;
        lock (replayLock)
        {
            clients.Remove(socket, out outbox);
        }
        outbox?.Writer.TryComplete();
    }

    private void OnSessionExited(SessionExit exit)
    {
        var message = FormatExitMessage(exit);
        if (message is not null)
        {
            Broadcast(Encoding.UTF8.GetBytes(message));
        }
    }

    internal static string? FormatExitMessage(SessionExit exit) => exit.Requested
        ? null
        : $"\r\n\e[31m[JobPilot.Terminal] {exit.ProviderDisplayName} exited with code {exit.ExitCode}. Use Restart to reopen.\e[0m\r\n";

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

    private async Task ReceiveLoopAsync(WebSocket socket, CancellationToken ct)
    {
        var buffer = new byte[ReceiveBufferSize];
        var message = new ArrayBufferWriter<byte>(ReceiveBufferSize);

        try
        {
            while (socket.State == WebSocketState.Open && !ct.IsCancellationRequested)
            {
                var result = await socket.ReceiveAsync(buffer, ct);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "client closed", ct);
                    return;
                }

                if (result.MessageType != WebSocketMessageType.Text)
                {
                    continue;
                }

                if (message.WrittenCount + result.Count > MaxMessageBytes)
                {
                    logger.LogWarning("Closing a WebSocket client that sent a message over {Limit} bytes.", MaxMessageBytes);
                    await socket.CloseAsync(WebSocketCloseStatus.MessageTooBig, "message too large", ct);
                    return;
                }

                message.Write(buffer.AsSpan(0, result.Count));

                if (!result.EndOfMessage)
                {
                    continue;
                }

                Dispatch(message.WrittenSpan);

                // Do not retain an oversized paste buffer for the connection lifetime.
                if (message.Capacity > ReceiveBufferSize)
                {
                    message = new ArrayBufferWriter<byte>(ReceiveBufferSize);
                }
                else
                {
                    message.ResetWrittenCount();
                }
            }
        }
        catch (OperationCanceledException)
        {
        }
        catch (WebSocketException ex)
        {
            logger.LogDebug(ex, "WebSocket closed.");
        }
    }

    private void Dispatch(ReadOnlySpan<byte> utf8Json)
    {
        TerminalClientMessage? message;
        try
        {
            message = JsonSerializer.Deserialize(utf8Json, AppJsonContext.Default.TerminalClientMessage);
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Ignoring a malformed WebSocket message.");
            return;
        }

        switch (message?.Type)
        {
            case "input":
                if (TryDecodeInput(message.Data, out var bytes))
                {
                    session.WriteInput(bytes);
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

    private bool TryDecodeInput(string? data, out byte[] bytes)
    {
        bytes = [];
        if (string.IsNullOrEmpty(data))
        {
            return false;
        }

        try
        {
            bytes = Convert.FromBase64String(data);
            return true;
        }
        catch (FormatException ex)
        {
            logger.LogWarning(ex, "Ignoring WebSocket input that is not valid base64.");
            return false;
        }
    }

    public void Dispose()
    {
        session.Output -= Broadcast;
        session.Exited -= OnSessionExited;
        session.Starting -= OnSessionStarting;

        foreach (var socket in SnapshotClients())
        {
            Unregister(socket);
        }
    }
}

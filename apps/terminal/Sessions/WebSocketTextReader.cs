using System.Buffers;
using System.Net.WebSockets;

namespace JobPilot.Terminal.Sessions;

/// <summary>Reassembles fragmented text messages from a socket, closing it on an oversized one.</summary>
internal static class WebSocketTextReader
{
    private const int ReceiveBufferSize = 8192;

    /// <summary>Calls <paramref name="onMessage"/> per whole text message until the socket closes.</summary>
    public static async Task ReadAsync(
        WebSocket socket,
        int maxMessageBytes,
        Action<ReadOnlySpan<byte>> onMessage,
        ILogger logger,
        CancellationToken ct)
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

                if (message.WrittenCount + result.Count > maxMessageBytes)
                {
                    logger.LogWarning("Closing a WebSocket client that sent a message over {Limit} bytes.", maxMessageBytes);
                    await socket.CloseAsync(WebSocketCloseStatus.MessageTooBig, "message too large", ct);
                    return;
                }

                message.Write(buffer.AsSpan(0, result.Count));
                if (!result.EndOfMessage)
                {
                    continue;
                }

                onMessage(message.WrittenSpan);

                // Do not hold an oversized paste buffer for the connection's lifetime.
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
}

using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace JobPilot.Terminal;

/// <summary>
/// Handles the browser WebSocket connection used by the embedded terminal.
/// </summary>
public sealed class TerminalHub(SessionManager session, ILogger<TerminalHub> logger)
{
    /// <summary>
    /// Registers a WebSocket client, receives terminal protocol messages, and forwards them to the
    /// active session.
    /// </summary>
    /// <param name="socket">Accepted WebSocket connection from the browser.</param>
    /// <param name="ct">Cancellation token tied to the HTTP request lifetime.</param>
    public async Task HandleAsync(WebSocket socket, CancellationToken ct)
    {
        session.RegisterClient(socket);
        logger.LogInformation("WebSocket client connected.");

        try
        {
            var buffer = new byte[8192];
            while (socket.State == WebSocketState.Open && !ct.IsCancellationRequested)
            {
                var result = await socket.ReceiveAsync(buffer, ct);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "client closed", ct);
                    break;
                }

                if (result.MessageType != WebSocketMessageType.Text)
                {
                  continue;
                }

                var text = Encoding.UTF8.GetString(buffer, 0, result.Count);
                Dispatch(text);
            }
        }
        catch (OperationCanceledException)
        {
        }
        catch (WebSocketException ex)
        {
            logger.LogDebug(ex, "WebSocket closed.");
        }
        finally
        {
            session.UnregisterClient(socket);
            logger.LogInformation("WebSocket client disconnected.");
        }
    }

    private void Dispatch(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (!root.TryGetProperty("type", out var typeProp))
            {
              return;
            }
            
            var type = typeProp.GetString();

            switch (type)
            {
                case "input":
                    if (root.TryGetProperty("data", out var dataProp))
                    {
                        var encoded = dataProp.GetString();
                        if (!string.IsNullOrEmpty(encoded))
                        {
                            var bytes = Convert.FromBase64String(encoded);
                            session.WriteInput(bytes);
                        }
                    }
                    break;

                case "resize":
                    var cols = root.GetProperty("cols").GetInt32();
                    var rows = root.GetProperty("rows").GetInt32();
                    session.Resize(cols, rows);
                    break;
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to dispatch WS message.");
        }
    }
}

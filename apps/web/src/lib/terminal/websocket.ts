"use client";

export interface WebSocketClient {
  /** Current native WebSocket readyState. */
  readonly readyState: number;

  /**
   * Close the socket with an optional WebSocket close code and reason.
   * Also detaches every callback: the caller is tearing down, so nothing fires after this.
   */
  close: (code?: number, reason?: string) => void;

  /** Send a JSON message if the socket is open. Returns false otherwise. */
  sendJson: (message: unknown) => boolean;
}

interface WebSocketOptions {
  /** Native WebSocket binaryType. Defaults to arraybuffer. */
  binaryType?: BinaryType;

  /** Called once the socket is open and ready to send. */
  onOpen?: (client: WebSocketClient, event: Event) => void;

  /** Called for text frames. */
  onText?: (data: string, event: MessageEvent<string>) => void;

  /** Called for ArrayBuffer frames, normalized to Uint8Array. */
  onBinary?: (data: Uint8Array, event: MessageEvent<ArrayBuffer>) => void;

  /** Called when the socket closes. */
  onClose?: (event: CloseEvent) => void;

  /** Called when the socket reports an error. */
  onError?: (event: Event) => void;
}

/**
 * Open a WebSocket and expose a small typed adapter for common app usage.
 *
 * The helper normalizes binary messages to Uint8Array and centralizes the
 * "send only when open" guard while leaving protocol-specific logic to callers.
 */
export function connectWebSocket(url: string, options: WebSocketOptions = {}): WebSocketClient {
  const socket = new WebSocket(url);
  socket.binaryType = options.binaryType ?? "arraybuffer";

  const client: WebSocketClient = {
    get readyState() {
      return socket.readyState;
    },
    close(code, reason) {
      detach();
      socket.close(code, reason);
    },
    sendJson(message) {
      if (socket.readyState !== WebSocket.OPEN) {
        return false;
      }
      socket.send(JSON.stringify(message));
      return true;
    },
  };

  const handleOpen = (event: Event): void => {
    options.onOpen?.(client, event);
  };
  const handleMessage = (event: MessageEvent): void => {
    if (event.data instanceof ArrayBuffer) {
      options.onBinary?.(new Uint8Array(event.data), event as MessageEvent<ArrayBuffer>);
    } else if (typeof event.data === "string") {
      options.onText?.(event.data, event as MessageEvent<string>);
    }
  };
  const handleClose = (event: CloseEvent): void => {
    options.onClose?.(event);
  };
  const handleError = (event: Event): void => {
    options.onError?.(event);
  };

  const detach = (): void => {
    socket.removeEventListener("open", handleOpen);
    socket.removeEventListener("message", handleMessage);
    socket.removeEventListener("close", handleClose);
    socket.removeEventListener("error", handleError);
  };

  socket.addEventListener("open", handleOpen);
  socket.addEventListener("message", handleMessage);
  socket.addEventListener("close", handleClose);
  socket.addEventListener("error", handleError);

  return client;
}

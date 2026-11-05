"use client";

export interface WebSocketClient {
  readonly readyState: number;

  /** Also detaches every callback, so nothing fires after teardown. */
  close: (code?: number, reason?: string) => void;

  /** False when the socket isn't open. */
  sendJson: (message: unknown) => boolean;
}

interface WebSocketOptions {
  /** Defaults to arraybuffer. */
  binaryType?: BinaryType;

  onOpen?: (client: WebSocketClient, event: Event) => void;

  onText?: (data: string, event: MessageEvent<string>) => void;

  onBinary?: (data: Uint8Array, event: MessageEvent<ArrayBuffer>) => void;

  onClose?: (event: CloseEvent) => void;

  onError?: (event: Event) => void;
}

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

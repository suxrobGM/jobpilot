export const TERMINAL_HTTP_URL = process.env.NEXT_PUBLIC_TERMINAL_URL ?? "http://localhost:8001";

export const TERMINAL_WS_URL = TERMINAL_HTTP_URL.replace(/^http/, "ws") + "/ws";

export type TerminalProviderId = "claude" | "codex";

export interface TerminalProviderInfo {
  id: TerminalProviderId;
  displayName: string;
}

export interface SessionStatus {
  status: string;
  session: "running" | "stopped";
  provider: TerminalProviderId;
  providers: TerminalProviderInfo[];
}

export class TerminalApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "TerminalApiError";
  }
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${TERMINAL_HTTP_URL}${path}`, {
    method,
    headers: body != null ? { "content-type": "application/json" } : undefined,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new TerminalApiError(
      response.status,
      `JobPilot.Terminal ${method} ${path} -> ${response.status}`,
    );
  }
  if (response.headers.get("content-length") === "0") {
    return null as T;
  }
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (null as T);
}

export function getStatus(): Promise<SessionStatus> {
  return send<SessionStatus>("GET", "/healthz");
}

interface StartOptions {
  cols: number;
  rows: number;
  provider: TerminalProviderId;
  /** Per-user agent PAT, injected into the PTY as JOBPILOT_API_TOKEN. */
  apiToken?: string;
}

export function startSession(options: StartOptions): Promise<SessionStatus> {
  return send<SessionStatus>("POST", "/sessions/start", options);
}

/**
 * Inject a command into the active session. Pass a bare command line with no
 * trailing newline — the terminal host submits it with a separate Enter keystroke.
 */
export function injectCommand(command: string, provider?: TerminalProviderId): Promise<void> {
  return send<void>("POST", "/sessions/inject", { command, provider });
}

export function killSession(): Promise<SessionStatus> {
  return send<SessionStatus>("DELETE", "/sessions/current");
}

export function formatSkillCommand(
  provider: TerminalProviderId,
  skill: string,
  args?: string,
): string {
  const suffix = args?.trim();
  const command = provider === "codex" ? `$${skill}` : `/jobpilot:${skill}`;
  return suffix ? `${command} ${suffix}` : command;
}

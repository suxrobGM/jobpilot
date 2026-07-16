export const TERMINAL_HTTP_URL = process.env.NEXT_PUBLIC_TERMINAL_URL ?? "http://localhost:4102";

export const TERMINAL_WS_URL = `${TERMINAL_HTTP_URL.replace(/^http/, "ws")}/ws`;

/** URL scheme the host registers on Windows; opening it relaunches an offline host from the browser. */
export const TERMINAL_PROTOCOL_URL = "jobpilot://start";

export type TerminalProviderId = "claude" | "codex";

/** Outcome of the pilot's last conductor cycle, as reported by the host's /healthz. */
export type PilotCycleStatus = "ok" | "empty" | "error";

export interface TerminalProviderInfo {
  id: TerminalProviderId;
  displayName: string;
}

/** Autonomous pilot-mode health from the host's /healthz. Additive; absent on older hosts. */
export interface PilotHealth {
  enabled: boolean;
  paired: boolean;
  conducting: boolean;
  lastCycleAt?: string | null;
  lastCycleStatus?: PilotCycleStatus | null;
  consecutiveTimeouts: number;
}

export interface SessionStatus {
  /** "ok", or "degraded" when the host runs but sessions can't start (e.g. plugin tree missing). */
  status: string;
  session: "running" | "stopped";
  provider: TerminalProviderId;
  providers: TerminalProviderInfo[];
  /** Host binary version, for the dashboard's "update available" prompt (the plugin self-updates). */
  hostVersion: string;
  /** Human-readable reason when status is "degraded". */
  detail?: string | null;
  /** True when the host registered the jobpilot:// scheme, so the browser can relaunch it when offline. */
  canRelaunch: boolean;
  /** True when this is a published install, so the dashboard can offer a one-click self-update. */
  canUpdate: boolean;
  /** Pilot loop state; null/absent on older hosts. */
  pilot?: PilotHealth | null;
}

/** Outcome of a dashboard-triggered host self-update (POST /update). */
export interface UpdateResult {
  /** True when the host swapped + relaunched and is shutting down; the health poll rides it back to reachable. */
  updating: boolean;
  fromVersion: string;
  toVersion?: string | null;
  /** Why nothing happened: the host is current, a dev checkout, already updating, or missing a build for this platform. */
  reason?: "up-to-date" | "dev-checkout" | "in-progress" | "no-asset" | null;
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
    // The host answers errors as ProblemDetails; surface its detail instead of a bare status.
    let message = `JobPilot.Terminal ${method} ${path} -> ${response.status}`;
    try {
      const problem = (await response.json()) as { detail?: string; title?: string } | null;
      message = problem?.detail ?? problem?.title ?? message;
    } catch {
      // empty or non-JSON body (older host) - keep the fallback
    }
    throw new TerminalApiError(response.status, message);
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
  /** Web app origin (this browser's location), injected into the PTY as JOBPILOT_WEB for user-facing links. */
  webUrl?: string;
  /** Backend base URL the web talks to, injected into the PTY as JOBPILOT_API so the agent hits the same (possibly remote) API. */
  apiUrl?: string;
}

export function startSession(options: StartOptions): Promise<SessionStatus> {
  return send<SessionStatus>("POST", "/sessions/start", options);
}

/**
 * Inject a command into the active session. Pass a bare command line with no
 * trailing newline - the terminal host submits it with a separate Enter keystroke.
 */
export function injectCommand(command: string, provider?: TerminalProviderId): Promise<void> {
  return send<void>("POST", "/sessions/inject", { command, provider });
}

export function killSession(): Promise<SessionStatus> {
  return send<SessionStatus>("DELETE", "/sessions/current");
}

interface PilotEnableOptions {
  provider: TerminalProviderId;
  /** Per-user agent PAT the pilot loop authenticates with. */
  apiToken: string;
  /** Backend base URL injected into the pilot PTY as JOBPILOT_API. */
  apiUrl: string;
  /** Web origin injected as JOBPILOT_WEB for user-facing links. */
  webUrl: string;
}

/** Store the provider pairing and start the local pilot loop. */
export function pilotEnable(options: PilotEnableOptions): Promise<SessionStatus> {
  return send<SessionStatus>("POST", "/pilot/enable", options);
}

/** Stop the local pilot loop; the host keeps the pairing and any mid-cycle session. */
export function pilotDisable(): Promise<SessionStatus> {
  return send<SessionStatus>("POST", "/pilot/disable");
}

/** Ask the running host to self-update and relaunch; on `updating: true` poll health to see it return on the new version. */
export function triggerUpdate(): Promise<UpdateResult> {
  return send<UpdateResult>("POST", "/update");
}

export function providerDisplayName(provider: TerminalProviderId): string {
  return provider === "codex" ? "Codex" : "Claude Code";
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

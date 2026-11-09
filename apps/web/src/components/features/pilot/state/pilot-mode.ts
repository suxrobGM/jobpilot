import type { PilotState } from "@jobpilot/contracts/pilot";
import type { PulseDotTone } from "@/components/ui/feedback";
import type { TerminalHealth } from "@/hooks/use-terminal-health";
import type { PilotHealth } from "@/lib/terminal/client";
import { formatRelativeTime, formatTimeUntil } from "@/utils/format";

/** `unknown`: no local host to ask whether it's paired, e.g. a remote host or a probe in flight. */
export type PilotMode =
  | "off"
  | "held"
  | "offline"
  | "outdated"
  | "working"
  | "starting"
  | "idle"
  | "unpaired"
  | "unknown";

interface PilotModeLook {
  tone: PulseDotTone;
  label: string;
  pulsing: boolean;
  /** No cycles can run, so live views grey out. */
  dimmed: boolean;
}

export const PILOT_MODE_LOOK: Record<PilotMode, PilotModeLook> = {
  // Off means autopilot off: what the user asks for still runs.
  off: { tone: "muted", label: "Autopilot off", pulsing: false, dimmed: false },
  held: {
    tone: "warning",
    label: "Waiting while you use the terminal",
    pulsing: false,
    dimmed: false,
  },
  offline: { tone: "warning", label: "Agent offline", pulsing: false, dimmed: true },
  outdated: { tone: "warning", label: "Agent needs an update", pulsing: false, dimmed: true },
  working: { tone: "primary", label: "Working", pulsing: true, dimmed: false },
  starting: { tone: "info", label: "Starting up", pulsing: true, dimmed: false },
  idle: { tone: "success", label: "Idle", pulsing: false, dimmed: false },
  unpaired: { tone: "info", label: "Waiting for agent", pulsing: false, dimmed: false },
  unknown: { tone: "success", label: "Running", pulsing: false, dimmed: false },
};

function isHostOffline(health: TerminalHealth | null): boolean {
  return health === "offline" || health === "uninstalled" || health === "blocked";
}

/** No host was ever reachable here, yet one is connected to the API. Stopped ("offline") wins, so Stop reads at once. */
export function isHostRemote(
  state: Pick<PilotState, "agentConnected">,
  health: TerminalHealth | null,
): boolean {
  return (health === "uninstalled" || health === "blocked") && state.agentConnected;
}

/** The user typed into the terminal recently, so the host holds new runs. */
function isHeld(pilot: PilotHealth | null): boolean {
  const heldUntil = pilot?.heldUntil;
  return heldUntil != null && new Date(heldUntil).getTime() > Date.now();
}

/** The host runs whenever paired; autopilot only decides whether it picks work on its own. */
export function pilotMode(
  state: Pick<
    PilotState,
    "autopilot" | "cycleCount" | "currentRun" | "agentConnected" | "agentOutdated"
  >,
  health: TerminalHealth | null,
  pilot: PilotHealth | null,
): PilotMode {
  // The server refuses an outdated agent, so it would otherwise read as offline.
  if (state.agentOutdated) {
    return "outdated";
  }
  if (isHostOffline(health) && !isHostRemote(state, health)) {
    return "offline";
  }
  if (state.currentRun) {
    return "working";
  }
  if (health === "reachable" && !pilot?.paired) {
    return "unpaired";
  }
  if (isHeld(pilot)) {
    return "held";
  }
  if (!state.autopilot) {
    return "off";
  }
  if (state.cycleCount === 0) {
    return "starting";
  }
  return pilot?.paired ? "idle" : "unknown";
}

/** What an idle pilot last found and when it looks again, e.g. "Checked 4m ago, nothing to do · wakes in 11m". */
export function idleCaption(pilot: PilotHealth | null, nextWakeAt: Date | null): string {
  const parts: string[] = [];
  const lastCycleAt = pilot?.lastCycleAt ?? null;
  if (pilot?.lastCycleStatus === "empty" && lastCycleAt) {
    parts.push(`Checked ${formatRelativeTime(lastCycleAt)} ago, nothing to do`);
  }
  if (nextWakeAt) {
    const due = nextWakeAt.getTime() <= Date.now();
    parts.push(due ? "next check due now" : `wakes in ${formatTimeUntil(nextWakeAt)}`);
  }
  return parts.join(" · ");
}

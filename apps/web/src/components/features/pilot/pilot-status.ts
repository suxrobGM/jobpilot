import type { PilotState } from "@jobpilot/contracts/pilot";
import type { PulseDotTone } from "@/components/ui/feedback";
import type { TerminalHealth } from "@/hooks/use-terminal-health";
import type { PilotHealth } from "@/lib/terminal";
import { formatRelativeTime, formatTimeUntil } from "@/utils/format";

export const PILOT_HOST_OFFLINE_MESSAGE =
  "Pilot is running but the terminal host is offline - start the JobPilot agent so cycles can run.";

/** `unknown` is a running pilot with no host to ask: mobile, or the first probe still in flight. */
export type PilotMode =
  | "off"
  | "offline"
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
  off: { tone: "muted", label: "Off", pulsing: false, dimmed: true },
  offline: { tone: "amber", label: "Agent offline", pulsing: false, dimmed: true },
  working: { tone: "violet", label: "Working", pulsing: true, dimmed: false },
  starting: { tone: "blue", label: "Starting up", pulsing: true, dimmed: false },
  idle: { tone: "green", label: "Idle", pulsing: false, dimmed: false },
  unpaired: { tone: "blue", label: "Waiting for agent", pulsing: false, dimmed: false },
  unknown: { tone: "green", label: "Running", pulsing: false, dimmed: false },
};

export function hasGoals(state: Pick<PilotState, "instructionsGoals">): boolean {
  return state.instructionsGoals.trim() !== "";
}

function isHostOffline(health: TerminalHealth | null): boolean {
  return health === "offline" || health === "uninstalled";
}

export function pilotMode(
  state: Pick<PilotState, "running" | "cycleCount">,
  health: TerminalHealth | null,
  pilot: PilotHealth | null,
): PilotMode {
  if (!state.running) {
    return "off";
  }
  if (isHostOffline(health)) {
    return "offline";
  }
  if (pilot?.conducting) {
    return "working";
  }
  if (state.cycleCount === 0) {
    return "starting";
  }
  if (pilot?.paired) {
    return "idle";
  }
  return health === "reachable" ? "unpaired" : "unknown";
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

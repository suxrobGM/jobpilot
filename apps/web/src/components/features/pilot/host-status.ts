import type { TerminalHealth } from "../agent-dock/use-terminal-health";

/** Right after Start there is no cycle history yet - say so instead of looking idle. */
export const PILOT_STARTING_UP_LABEL = "Starting up - first cycle begins shortly";

/** Running but no local host is up to execute cycles. */
export const PILOT_HOST_OFFLINE_MESSAGE =
  "Pilot is running but the terminal host is offline - start the JobPilot agent so cycles can run.";

export function isHostOffline(health: TerminalHealth | null): boolean {
  return health === "offline" || health === "uninstalled";
}

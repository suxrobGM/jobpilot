/** Sent by the terminal host and the skills' `jobpilot-api` helper on every call. */
export const AGENT_VERSION_HEADER = "x-jobpilot-version";

/** Older agents call routes this API no longer serves; raise it with a breaking release. */
const MIN_AGENT_VERSION = "2.4.1";

/** Agents from before the header existed send none, so a missing one is outdated too. */
export function isOutdatedAgent(version: string | undefined): boolean {
  const trimmed = version?.trim() ?? "";
  if (!/^\d+\.\d+\.\d+/.test(trimmed)) {
    return true;
  }
  return Bun.semver.order(trimmed, MIN_AGENT_VERSION) < 0;
}

/** A refused agent keeps retrying; past this quiet spell it was stopped or updated. */
const REFUSED_FOR_MS = 10 * 60 * 1000;

/** In memory like agent presence: the web reads it to say "update" rather than "offline". */
const refusedAt = new Map<string, number>();

export function noteAgentVersion(userId: string, outdated: boolean): void {
  if (outdated) {
    refusedAt.set(userId, Date.now());
  } else {
    refusedAt.delete(userId);
  }
}

export function agentRefusedRecently(userId: string): boolean {
  const at = refusedAt.get(userId);
  return at !== undefined && Date.now() - at < REFUSED_FOR_MS;
}

export const OUTDATED_AGENT_MESSAGE = `Update JobPilot on your computer to ${MIN_AGENT_VERSION} or later; this version can no longer work with the server.`;

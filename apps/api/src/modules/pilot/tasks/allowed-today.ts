import type { NetworkingAutonomy, NetworkingMode } from "@jobpilot/contracts/networking";
import { channelAutonomy, networkingMode, type PilotConfig } from "@jobpilot/contracts/pilot";

interface GateCounts {
  appliedToday: number;
  networkingSentToday: number;
}

export interface AllowedToday {
  /** Null when email is off: sends and followups only ever act on email threads. */
  emailAutonomy: NetworkingAutonomy | null;
  /** The channel warm intros go out on, or null when outreach is off. */
  outreach: NetworkingMode | null;
  /** Applications left today; 0 is the cap, so a cap of 0 reads as reached. */
  appliesLeft: number;
  /** Networking sends left today. */
  sendsLeft: number;
}

/** What the config and today's counts allow. The gather, the build and the pilot state all read this. */
export function allowedToday(config: PilotConfig, counts: GateCounts): AllowedToday {
  return {
    emailAutonomy: channelAutonomy(config, "email"),
    outreach: networkingMode(config),
    appliesLeft: Math.max(0, config.dailyApplyCap - counts.appliedToday),
    sendsLeft: Math.max(0, config.networking.dailyCap - counts.networkingSentToday),
  };
}

import { pilotChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import type { AuthUser } from "@/common/auth/types";
import { publish } from "@/common/sse";
import { unrefTimer } from "@/common/utils/async";
import { AgentOfflineAlert } from "./agent-offline-alert";

// The host reopens a dropped stream after 5s; the grace hides that blip from other devices.
const OFFLINE_GRACE_MS = 15_000;

/** Whether the user's host holds an event stream open. In-process, like the SSE broker. */
@injectable()
export class AgentPresence {
  private readonly openStreams = new Map<string, number>();
  private readonly goingOffline = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly offlineAlert = inject(AgentOfflineAlert)) {}

  isConnected(userId: string): boolean {
    return this.openStreams.has(userId) || this.goingOffline.has(userId);
  }

  /** Only the host streams with the terminal token, so only its stream's lifetime is presence. */
  async *track<T>(
    user: AuthUser,
    events: AsyncGenerator<T, void, unknown>,
  ): AsyncGenerator<T, void, unknown> {
    if (user.tokenKind !== "terminal") {
      yield* events;
      return;
    }
    this.streamOpened(user.id);
    try {
      yield* events;
    } finally {
      this.streamClosed(user.id);
    }
  }

  private announce(userId: string, connected: boolean): void {
    publish(pilotChannel, { userId }, { type: "agent.presence", connected });
    this.offlineAlert.presenceChanged(userId, connected);
  }

  private streamOpened(userId: string): void {
    const count = this.openStreams.get(userId) ?? 0;
    this.openStreams.set(userId, count + 1);
    const pending = this.goingOffline.get(userId);
    if (pending) {
      clearTimeout(pending);
      this.goingOffline.delete(userId);
      return;
    }
    if (count === 0) {
      this.announce(userId, true);
    }
  }

  private streamClosed(userId: string): void {
    const count = (this.openStreams.get(userId) ?? 1) - 1;
    if (count > 0) {
      this.openStreams.set(userId, count);
      return;
    }
    this.openStreams.delete(userId);
    const timer = setTimeout(() => {
      this.goingOffline.delete(userId);
      this.announce(userId, false);
    }, OFFLINE_GRACE_MS);
    unrefTimer(timer);
    this.goingOffline.set(userId, timer);
  }
}

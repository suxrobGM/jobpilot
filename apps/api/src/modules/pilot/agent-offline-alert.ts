import { inject, injectable } from "@needle-di/core";
import { unrefTimer } from "@/common/utils/async";
import { PrismaClient } from "@/generated/prisma/client";
import { WebPushService } from "@/modules/web-push/web-push.service";

// Long enough to ride out host restarts and updates; a laptop asleep overnight still alerts.
const ALERT_AFTER_MS = 10 * 60_000;
// At most twice a day, so a nightly sleep doesn't nag.
const ALERT_COOLDOWN_MS = 12 * 60 * 60_000;

/** Pushes when the agent stays away while autopilot expects it to be working. */
@injectable()
export class AgentOfflineAlert {
  private readonly waiting = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly lastSentAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly push = inject(WebPushService),
  ) {}

  presenceChanged(userId: string, connected: boolean): void {
    const timer = this.waiting.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.waiting.delete(userId);
    }
    if (connected) {
      return;
    }
    const next = setTimeout(() => {
      this.waiting.delete(userId);
      void this.alert(userId);
    }, ALERT_AFTER_MS);
    unrefTimer(next);
    this.waiting.set(userId, next);
  }

  private async alert(userId: string): Promise<void> {
    const lastSentAt = this.lastSentAt.get(userId) ?? 0;
    if (Date.now() - lastSentAt < ALERT_COOLDOWN_MS) {
      return;
    }
    try {
      const state = await this.prisma.pilotState.findUnique({
        where: { userId },
        select: { autopilot: true },
      });
      if (!state?.autopilot) {
        return;
      }
      this.lastSentAt.set(userId, Date.now());
      await this.push.sendToUser(userId, {
        title: "Your agent is offline",
        body: "Autopilot is on, but the agent on your computer stopped. Start it to keep applying.",
        url: "/pilot",
        tag: "agent-offline",
      });
    } catch (error) {
      console.error("[agent-offline-alert] failed", error);
    }
  }
}

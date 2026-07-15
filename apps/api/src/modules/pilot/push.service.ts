import { inject, singleton } from "tsyringe";
import webpush from "web-push";
import { PrismaClient } from "@/generated/prisma/client";

/** VAPID credentials; injected as `null` when any of the three env vars is unset (push disabled). */
export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** DI token for the VAPID config. Held in a wrapper so the useValue provider is never `null`. */
export const VAPID_CONFIG = Symbol("VAPID_CONFIG");
export interface VapidConfigHolder {
  vapid: VapidConfig | null;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** A push endpoint the receiver has dropped, so we prune the stored subscription. */
const GONE_STATUSES = new Set([404, 410]);

// Intentionally no @/common/logger here: it imports @/env, which validates at load and would make
// this module (and PilotService, which depends on it) impossible to unit-test without a full env.

@singleton()
export class PushService {
  private readonly vapid: VapidConfig | null;

  constructor(
    private readonly prisma: PrismaClient,
    @inject(VAPID_CONFIG) config: VapidConfigHolder,
  ) {
    this.vapid = config.vapid;
    if (this.vapid) {
      webpush.setVapidDetails(this.vapid.subject, this.vapid.publicKey, this.vapid.privateKey);
    }
  }

  get isConfigured(): boolean {
    return this.vapid !== null;
  }

  /** The application-server key the browser needs to `pushManager.subscribe`; null when unconfigured. */
  get publicKey(): string | null {
    return this.vapid?.publicKey ?? null;
  }

  /** Upsert by endpoint. An endpoint can move between users (shared device), so a conflict reassigns it. */
  async subscribe(
    profileId: string,
    input: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string },
  ) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        profileId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
      },
      update: {
        profileId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
      },
      select: { id: true, endpoint: true, createdAt: true },
    });
  }

  /** Delete the caller's own subscription for this endpoint; returns the removed id (404 if not owned). */
  async unsubscribe(profileId: string, endpoint: string): Promise<string | null> {
    const row = await this.prisma.pushSubscription.findFirst({
      where: { profileId, endpoint },
      select: { id: true },
    });
    if (!row) {
      return null;
    }
    await this.prisma.pushSubscription.delete({ where: { id: row.id } });
    return row.id;
  }

  async list(profileId: string) {
    return this.prisma.pushSubscription.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
      select: { id: true, endpoint: true, userAgent: true, createdAt: true },
    });
  }

  /**
   * Fan a notification out to every one of the profile's subscriptions. Never throws: catches
   * internally so a call-site `void push.sendToProfile(...)` cannot poison the request path. A
   * 404/410 prunes the dead subscription; other errors are logged and swallowed.
   */
  async sendToProfile(profileId: string, payload: PushPayload): Promise<void> {
    if (!this.isConfigured) {
      return;
    }
    try {
      const subs = await this.prisma.pushSubscription.findMany({
        where: { profileId },
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      });
      const body = JSON.stringify(payload);
      await Promise.all(subs.map((sub) => this.deliver(sub, body)));
    } catch (err) {
      console.error("[push] sendToProfile failed", err);
    }
  }

  private async deliver(
    sub: { id: string; endpoint: string; p256dh: string; auth: string },
    body: string,
  ): Promise<void> {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
      );
    } catch (err) {
      if (err instanceof webpush.WebPushError && GONE_STATUSES.has(err.statusCode)) {
        await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        return;
      }
      console.error("[push] delivery failed", err);
    }
  }
}

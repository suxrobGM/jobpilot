import {
  dismissedNoticesSchema,
  type PilotConfig,
  type PilotNoticeKey,
  pilotConfigSchema,
} from "@jobpilot/contracts/pilot";
import { inject, injectable } from "@needle-di/core";
import { DAY_MS } from "@/common/date/buckets";
import { toInputJson } from "@/common/json";
import { allNamed } from "@/common/utils";
import { type EmailAccount, PrismaClient } from "@/generated/prisma/client";
import {
  buildNotices,
  CAP_WINDOW_MS,
  NEAR_MISS_BAND,
  NEAR_MISS_WINDOW_MS,
  type NoticeFacts,
  OUTCOMES_WINDOW_MS,
  STALE_MAIL_MS,
} from "./notice-signals";

const DISMISS_MS = 14 * DAY_MS;

interface FactsInput {
  config: PilotConfig;
  autopilotSince: Date | null;
}

function emailStatus(account: Pick<EmailAccount, "refreshFailedAt"> | null): NoticeFacts["email"] {
  if (!account) return "missing";
  return account.refreshFailedAt ? "reconnect" : "connected";
}

/** Computed on read from live data; only dismissals are stored. */
@injectable()
export class NoticeService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  async list(userId: string, now = new Date()) {
    const state = await this.prisma.pilotState.findUnique({
      where: { userId },
      select: {
        config: true,
        autopilot: true,
        autopilotSince: true,
        dismissedNotices: true,
      },
    });
    const dismissed = dismissedNoticesSchema.parse(state?.dismissedNotices ?? {});
    const facts = await this.gatherFacts(userId, now, {
      config: pilotConfigSchema.parse(state?.config ?? {}),
      autopilotSince: state?.autopilot ? (state.autopilotSince ?? null) : null,
    });
    return buildNotices(facts, now).filter((notice) => {
      const until = dismissed[notice.key];
      return !until || until <= now;
    });
  }

  /** Hides the notice for two weeks; it comes back if the signal still holds. */
  async dismiss(userId: string, key: PilotNoticeKey, now = new Date()) {
    const state = await this.prisma.pilotState.findUnique({
      where: { userId },
      select: { dismissedNotices: true },
    });
    const saved = dismissedNoticesSchema.parse(state?.dismissedNotices ?? {});
    const current = Object.fromEntries(Object.entries(saved).filter(([, until]) => until > now));
    const dismissedNotices = toInputJson({
      ...current,
      [key]: new Date(now.getTime() + DISMISS_MS),
    });
    await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId, dismissedNotices },
      update: { dismissedNotices },
    });
    return this.list(userId, now);
  }

  private async gatherFacts(userId: string, now: Date, input: FactsInput): Promise<NoticeFacts> {
    const { config, autopilotSince } = input;
    const { prisma } = this;
    const ago = (ms: number) => new Date(now.getTime() - ms);
    const outcomesSince = ago(OUTCOMES_WINDOW_MS);
    const { account, ...counts } = await allNamed({
      account: prisma.emailAccount.findUnique({
        where: { userId },
        select: { refreshFailedAt: true },
      }),
      // The set the inbox review reads.
      staleMail: prisma.emailMessage.count({
        where: {
          account: { userId },
          classification: null,
          reviewStatus: "pending",
          receivedAt: { lt: ago(STALE_MAIL_MS) },
        },
      }),
      recentApplications: prisma.application.count({
        where: { userId, appliedAt: { gte: outcomesSince } },
      }),
      progressed: prisma.application.count({
        where: {
          userId,
          appliedAt: { gte: outcomesSince },
          status: { in: ["screening", "interviewing", "offer"] },
        },
      }),
      recruiterReplies: prisma.emailMessage.count({
        where: {
          account: { userId },
          classification: { in: ["interviewing", "offer"] },
          receivedAt: { gte: outcomesSince },
        },
      }),
      nearMisses: prisma.job.count({
        where: {
          userId,
          createdAt: { gte: ago(NEAR_MISS_WINDOW_MS) },
          matchScore: { gte: config.minScore - NEAR_MISS_BAND, lt: config.minScore },
        },
      }),
      appliedLastWeek: prisma.application.count({
        where: { userId, appliedAt: { gte: ago(CAP_WINDOW_MS) } },
      }),
      approvedWaiting: prisma.job.count({ where: { userId, status: "approved" } }),
    });
    return {
      ...counts,
      email: emailStatus(account),
      minScore: config.minScore,
      dailyApplyCap: config.dailyApplyCap,
      autopilotSince,
    };
  }
}

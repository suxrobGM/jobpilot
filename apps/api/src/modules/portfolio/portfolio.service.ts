import { resumeDataSchema } from "@jobpilot/contracts/resume";
import { parseAvailability } from "@jobpilot/contracts/user";
import { singleton } from "tsyringe";
import { bucketPerDay, DAY_MS, startOfDay } from "@/common/date/buckets";
import { notFound } from "@/common/errors";
import { PrismaClient } from "@/generated/prisma/client";
import type { LeaderboardResponse, LeaderboardWindow, PortfolioResponse } from "./portfolio.schema";

const HEATMAP_DAYS = 365;

/** Interviewing = anything past the initial submit; mirrors analytics' non-interviewing set. */
const NON_INTERVIEWING_STATUSES = ["applied", "rejected", "withdrawn"] as const;

const WINDOW_DAYS: Record<Exclude<LeaderboardWindow, "all">, number> = { week: 7, month: 30 };

const activity = (r: { applications: number; messagesSent: number }) =>
  r.applications + r.messagesSent;

const LEADERBOARD_CAP = 50;
const LEADERBOARD_TTL_MS = 5 * 60 * 1000;

interface CachedLeaderboard {
  expires: number;
  data: LeaderboardResponse;
}

/** Backs the public /u/[username] page and /leaderboard - deliberately unauthenticated. */
@singleton()
export class PortfolioService {
  constructor(private readonly prisma: PrismaClient) {}

  // Cache is keyed by window; monotonic Date.now() TTL, no cross-user data (published only).
  private readonly leaderboardCache = new Map<LeaderboardWindow, CachedLeaderboard>();

  /** Public view: every account has an always-public portfolio; 404s only on an unknown username. */
  async byUsername(username: string): Promise<PortfolioResponse> {
    return this.build({ username }, "Portfolio not found");
  }

  /** Authed self-preview by user id (same card the public sees). */
  async previewByUserId(userId: string): Promise<PortfolioResponse> {
    return this.build({ id: userId }, "User not found");
  }

  private async build(
    where: { username: string } | { id: string },
    notFoundMessage: string,
  ): Promise<PortfolioResponse> {
    const user = await this.prisma.user.findFirst({
      where,
      select: {
        id: true,
        username: true,
        availability: true,
        firstName: true,
        lastName: true,
        website: true,
        linkedin: true,
        github: true,
        showResume: true,
        showWebsite: true,
        showLinkedin: true,
        showGithub: true,
        city: true,
        state: true,
        primaryResumeId: true,
      },
    });

    if (!user) {
      throw notFound(notFoundMessage);
    }

    const start = this.heatmapStart();

    // Totals are counts (all-time); the heatmap only fetches rows inside its window, so row
    // transfer stays bounded to 365 days regardless of how long the account has been active.
    const [resume, applicationTotal, interviews, messageTotal, appliedDates, messages] =
      await Promise.all([
        user.primaryResumeId
          ? this.prisma.resume.findUnique({
              where: { id: user.primaryResumeId },
              select: { content: true },
            })
          : Promise.resolve(null),
        this.prisma.application.count({ where: { userId: user.id } }),
        this.prisma.application.count({
          where: { userId: user.id, status: { notIn: [...NON_INTERVIEWING_STATUSES] } },
        }),
        this.prisma.networkingMessage.count({
          where: { userId: user.id, sentAt: { not: null } },
        }),
        this.prisma.application.findMany({
          where: { userId: user.id, appliedAt: { gte: start } },
          select: { appliedAt: true },
        }),
        this.prisma.networkingMessage.findMany({
          where: { userId: user.id, sentAt: { gte: start } },
          select: { sentAt: true },
        }),
      ]);

    const messageDates = messages.map((m) => m.sentAt).filter((d): d is Date => d !== null);
    const perDay = bucketPerDay(
      [...appliedDates.map((a) => a.appliedAt), ...messageDates],
      start,
      HEATMAP_DAYS,
    );

    const content = this.parseResume(resume?.content ?? null);
    const username = user.username ?? "";
    const displayName = `${user.firstName} ${user.lastName}`.trim() || username;
    const location =
      [user.city, user.state].filter(Boolean).join(", ") || content?.basics.location || null;

    const cutoff = startOfDay(new Date()).getTime() - 29 * DAY_MS;
    const activityLast30 = perDay
      .filter((p) => p.date.getTime() >= cutoff)
      .reduce((n, p) => n + p.count, 0);
    const streaks = this.streaks(perDay);

    return {
      username,
      displayName,
      headline: content?.basics.headline?.trim() || null,
      location,
      availability: parseAvailability(user.availability),
      summary: content?.summary?.trim() || null,
      links: {
        website: user.showWebsite ? user.website || content?.basics.website || null : null,
        linkedin: user.showLinkedin ? user.linkedin || content?.basics.linkedin || null : null,
        github: user.showGithub ? user.github || content?.basics.github || null : null,
      },
      skills: content ? content.skills.flatMap((g) => g.items) : [],
      // Withholding the id is the boundary - the PDF route stays open for already-sent email links.
      primaryResumeId: user.showResume ? (user.primaryResumeId ?? null) : null,
      perDay,
      stats: {
        applications: applicationTotal,
        interviews,
        messagesSent: messageTotal,
        activityLast30,
        currentStreak: streaks.current,
        longestStreak: streaks.longest,
      },
    };
  }

  async leaderboard(window: LeaderboardWindow = "month"): Promise<LeaderboardResponse> {
    const cached = this.leaderboardCache.get(window);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const gte =
      window === "all"
        ? undefined
        : new Date(startOfDay(new Date()).getTime() - (WINDOW_DAYS[window] - 1) * DAY_MS);

    // No `userId in (...)` list: rows carry their owner, so this is one row per *active* user.
    const [appRows, msgRows] = await Promise.all([
      this.prisma.application.groupBy({
        by: ["userId"],
        where: gte ? { appliedAt: { gte } } : {},
        _count: { _all: true },
      }),
      this.prisma.networkingMessage.groupBy({
        by: ["userId"],
        where: gte ? { sentAt: { gte } } : { sentAt: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const apps = new Map(appRows.map((r) => [r.userId, r._count._all]));
    const messages = new Map(msgRows.map((r) => [r.userId, r._count._all]));

    const active = [...new Set([...apps.keys(), ...messages.keys()])].map((id) => ({
      id,
      applications: apps.get(id) ?? 0,
      messagesSent: messages.get(id) ?? 0,
    }));

    // Cap before reading any user row, so only the survivors are fetched.
    const ranked = active.sort((a, b) => activity(b) - activity(a)).slice(0, LEADERBOARD_CAP);

    const users = await this.prisma.user.findMany({
      where: { id: { in: ranked.map((r) => r.id) } },
      select: {
        id: true,
        username: true,
        availability: true,
        firstName: true,
        lastName: true,
        primaryResumeId: true,
      },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    // Headline only for the ranked subset - avoids parsing every user's resume JSON.
    const resumeIds = users.map((u) => u.primaryResumeId).filter((id): id is string => !!id);
    const resumes = resumeIds.length
      ? await this.prisma.resume.findMany({
          where: { id: { in: resumeIds } },
          select: { id: true, content: true },
        })
      : [];
    const headlineById = new Map(
      resumes.map((r) => [r.id, this.parseResume(r.content)?.basics.headline?.trim() || null]),
    );

    // Rank after the join, so numbers stay contiguous if a user row has gone missing.
    const rows = ranked
      .flatMap((r) => {
        const user = userById.get(r.id);
        return user ? [{ ...r, user }] : [];
      })
      .map(({ user, ...r }, i) => ({
        rank: i + 1,
        username: user.username,
        displayName: `${user.firstName} ${user.lastName}`.trim() || user.username,
        headline: user.primaryResumeId ? (headlineById.get(user.primaryResumeId) ?? null) : null,
        availability: parseAvailability(user.availability),
        applications: r.applications,
        messagesSent: r.messagesSent,
        activityCount: activity(r),
      }));

    const data: LeaderboardResponse = { window, totalActive: active.length, rows };
    this.leaderboardCache.set(window, { expires: Date.now() + LEADERBOARD_TTL_MS, data });
    return data;
  }

  async sitemap(): Promise<{ username: string; updatedAt: Date }[]> {
    return this.prisma.user.findMany({
      select: { username: true, updatedAt: true },
      take: 5000,
    });
  }

  private heatmapStart(): Date {
    const d = startOfDay(new Date());
    d.setUTCDate(d.getUTCDate() - (HEATMAP_DAYS - 1));
    return d;
  }

  /** Current streak = consecutive active days ending today; longest = max run in the window. */
  private streaks(perDay: { date: Date; count: number }[]): { current: number; longest: number } {
    let longest = 0;
    let run = 0;
    for (const p of perDay) {
      run = p.count > 0 ? run + 1 : 0;
      if (run > longest) longest = run;
    }
    let current = 0;
    for (let i = perDay.length - 1; i >= 0 && perDay[i].count > 0; i--) current++;
    return { current, longest };
  }

  private parseResume(content: string | null) {
    if (!content) return null;
    try {
      const parsed = resumeDataSchema.safeParse(JSON.parse(content));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
}

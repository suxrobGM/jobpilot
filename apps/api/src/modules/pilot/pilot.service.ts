import {
  type PilotState,
  pilotConfigSchema,
  type RecordCycleInput,
  type UpdatePilotSettingsInput,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import { unprocessable } from "@/common/errors";
import { toInputJson } from "@/common/json";
import { agentRefusedRecently } from "@/common/middleware/agent-version";
import { publish } from "@/common/sse";
import { type PilotState as PilotStateModel, PrismaClient } from "@/generated/prisma/client";
import { boardDomain } from "@/modules/job-board/board-host";
import { AgentPresence } from "./agent-presence";
import { MessageService } from "./messages/message.service";
import { costByTaskType, countAppliedToday, countSentToday } from "./pilot.stats";
import { allowedToday } from "./tasks/allowed-today";
import { TASK_LIST_SNAPSHOT_RESET } from "./tasks/snapshot";

function latest(times: Date[]): Date | null {
  return times.reduce<Date | null>((max, time) => (!max || time > max ? time : max), null);
}

@injectable()
export class PilotService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly presence = inject(AgentPresence),
    private readonly messages = inject(MessageService),
  ) {}

  private async toState(row: PilotStateModel): Promise<PilotState> {
    const config = pilotConfigSchema.parse(row.config);
    const now = new Date();
    const [appliedToday, networkingSentToday, openRun, pendingRequests] = await Promise.all([
      countAppliedToday(this.prisma, row.userId, now),
      countSentToday(this.prisma, row.userId, now),
      this.prisma.pilotRun.findFirst({
        where: { userId: row.userId, finishedAt: null, expiresAt: { gt: now } },
        orderBy: { startedAt: "desc" },
        select: { id: true, taskType: true, title: true, startedAt: true },
      }),
      this.prisma.pilotRequest.count({ where: { userId: row.userId, status: "pending" } }),
    ]);
    return {
      userId: row.userId,
      autopilot: row.autopilotSince !== null,
      config,
      lastCycleAt: row.lastCycleAt,
      nextWakeAt: row.nextWakeAt,
      cycleCount: row.cycleCount,
      appliedToday,
      networkingSentToday,
      capReached: allowedToday(config, { appliedToday, networkingSentToday }).appliesLeft === 0,
      agentConnected: this.presence.isConnected(row.userId),
      agentOutdated: agentRefusedRecently(row.userId),
      pendingRequests,
      currentRun: openRun,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /** Every state write publishes, so the web and the terminal see the same row. */
  private async publishState(row: PilotStateModel) {
    const state = await this.toState(row);
    publish(pilotChannel, { userId: row.userId }, { type: "state.changed", state });
    return state;
  }

  /** Every profile has exactly one state row, created with defaults on first read. */
  async getState(userId: string) {
    const row = await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return this.toState(row);
  }

  /** Settings outside the rules; a change rebuilds the task list. */
  async updateSettings(userId: string, body: UpdatePilotSettingsInput) {
    const saved = await this.prisma.pilotState.findUnique({
      where: { userId },
      select: { config: true },
    });
    const config = pilotConfigSchema.parse(saved?.config ?? {});
    const boards = body.boards ? await this.linkedRotation(userId, body.boards) : config.boards;
    const data = {
      config: toInputJson({ ...config, ...body, boards }),
      ...TASK_LIST_SNAPSHOT_RESET,
    };
    const row = await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.publishState(row);
  }

  /** Rotation entries as stored domains, in order, once. The searcher only opens linked boards. */
  private async linkedRotation(userId: string, entries: string[]): Promise<string[]> {
    const domains = [...new Set(entries.map((entry) => boardDomain(entry) ?? entry))];
    const linked = await this.prisma.userJobBoard.findMany({
      where: { userId, board: { domain: { in: domains } } },
      select: { board: { select: { domain: true } } },
    });
    const known = new Set(linked.map((link) => link.board.domain));
    const missing = domains.filter((domain) => !known.has(domain));
    if (missing.length > 0) {
      throw unprocessable(`Add ${missing.join(", ")} on the Job boards page before searching it.`);
    }
    return domains;
  }

  /** Autopilot gates only autonomous work; with no searches yet, it starts from the resume. */
  async setAutopilot(userId: string, enabled: boolean) {
    const saved = await this.prisma.pilotState.findUnique({
      where: { userId },
      select: { autopilotSince: true },
    });
    // Turning it on again keeps the original start.
    const autopilotSince = enabled ? (saved?.autopilotSince ?? new Date()) : null;
    const row = await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId, autopilotSince },
      update: { autopilotSince, ...TASK_LIST_SNAPSHOT_RESET },
    });
    return this.publishState(row);
  }

  /** Every cycle counts, idle or not, so board rotation advances while idle. */
  async recordCycle(userId: string, body: RecordCycleInput) {
    const now = new Date();
    const nextWakeAt = new Date(now.getTime() + body.sleepSeconds * 1000);
    const row = await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId, lastCycleAt: now, cycleCount: 1, nextWakeAt },
      update: { lastCycleAt: now, cycleCount: { increment: 1 }, nextWakeAt },
    });
    if (body.message) {
      await this.messages.postFromPilot(userId, body.message, {
        title: "Pilot alert",
        tag: "pilot-alert",
      });
    }
    return this.publishState(row);
  }

  /** For state writes made by other services. */
  async publishCurrentState(userId: string) {
    const row = await this.prisma.pilotState.findUnique({ where: { userId } });
    if (row) {
      await this.publishState(row);
    }
  }

  async getCost(userId: string) {
    return { items: await costByTaskType(this.prisma, userId, new Date()) };
  }

  /** Newest server-side activity, so the terminal can tell a slow live cycle from a stuck one. */
  async getActivity(userId: string) {
    const { prisma } = this;
    const [runs, finished, feed, job, state] = await Promise.all([
      prisma.pilotRun.findMany({
        where: { userId, finishedAt: null },
        select: { startedAt: true, heartbeatAt: true, expiresAt: true },
      }),
      prisma.pilotRun.aggregate({ where: { userId }, _max: { finishedAt: true } }),
      prisma.feed.aggregate({ where: { userId }, _max: { updatedAt: true } }),
      prisma.job.aggregate({ where: { userId }, _max: { updatedAt: true } }),
      prisma.pilotState.findUnique({
        where: { userId },
        select: { lastCycleAt: true, nextWakeAt: true },
      }),
    ]);

    const times = [
      ...runs.flatMap((run) => [run.startedAt, run.heartbeatAt]),
      finished._max.finishedAt,
      feed._max.updatedAt,
      job._max.updatedAt,
    ].filter((time) => time != null);
    const now = new Date();
    const lastCycleAt = state?.lastCycleAt ?? null;
    const nextWakeAt = state?.nextWakeAt ?? null;

    return {
      lastActivityAt: latest(times),
      // An expired run nobody has swept yet still counts as activity, but not as active.
      activeRuns: runs.filter((run) => run.expiresAt > now).length,
      // A stuck-recovery cycle plans no wake, and the host still needs its completedAt.
      lastCycle: lastCycleAt && {
        completedAt: lastCycleAt,
        sleepSeconds: nextWakeAt
          ? Math.round((nextWakeAt.getTime() - lastCycleAt.getTime()) / 1000)
          : null,
      },
    };
  }
}

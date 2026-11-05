import type { CreatePilotChangeInput, PilotChangeAction } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import { conflict, findOwned, forbidden } from "@/common/errors";
import { toInputJson } from "@/common/json";
import { publish } from "@/common/sse";
import {
  type PilotChange as PilotChangeModel,
  type PilotChangeStatus,
  PrismaClient,
} from "@/generated/prisma/client";
import { JobBoardService } from "@/modules/job-board/job-board.service";
import { PilotService } from "../pilot.service";
import { TASK_LIST_SNAPSHOT_RESET } from "../tasks/snapshot";
import type { ActionContext } from "./action-context";
import { applyActions } from "./apply-action";
import { canUndo, storedActionsSchema, toPilotChange } from "./change-row";

/** The pilot changes its own searches but only suggests edits to what the user decided. */
const USER_OWNED_ACTIONS: PilotChangeAction["type"][] = [
  "goals.set",
  "rules.set",
  "answer.set",
  "answer.delete",
];

/** Goals and rules live on the pilot state, so changing them republishes it. */
const STATE_ACTIONS: PilotChangeAction["type"][] = ["goals.set", "rules.set"];

@injectable()
export class ChangeService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly boards = inject(JobBoardService),
    private readonly pilot = inject(PilotService),
  ) {}

  async list(userId: string, status?: PilotChangeStatus) {
    const rows = await this.prisma.pilotChange.findMany({
      where: { userId, ...(status && { status }) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const now = Date.now();
    return rows.map((row) => toPilotChange(row, now));
  }

  async create(userId: string, input: CreatePilotChangeInput) {
    const { summary, actions, source, runId } = input;
    const autonomous = source === "pilot" || source === "notice";
    if (autonomous && !input.propose && actions.some((a) => USER_OWNED_ACTIONS.includes(a.type))) {
      throw forbidden("The pilot can only propose changes to goals, rules and answers.");
    }
    if (input.propose) {
      const row = await this.prisma.pilotChange.create({
        data: {
          userId,
          source,
          status: "proposed",
          summary,
          actions: toInputJson(actions),
          runId: runId ?? null,
        },
      });
      return this.publishChange(row);
    }
    return this.run(userId, actions, (tx, undo, now) =>
      tx.pilotChange.create({
        data: {
          userId,
          source,
          status: "applied",
          summary,
          actions: toInputJson(actions),
          undo: toInputJson(undo),
          runId: runId ?? null,
          decidedAt: now,
        },
      }),
    );
  }

  async applyProposed(userId: string, id: string) {
    const row = await this.findChange(userId, id, "proposed");
    return this.run(userId, storedActionsSchema.parse(row.actions), (tx, undo, now) =>
      tx.pilotChange.update({
        where: { id },
        data: { status: "applied", undo: toInputJson(undo), decidedAt: now },
      }),
    );
  }

  async dismiss(userId: string, id: string) {
    await this.findChange(userId, id, "proposed");
    const row = await this.prisma.pilotChange.update({
      where: { id },
      data: { status: "dismissed", decidedAt: new Date() },
    });
    return this.publishChange(row);
  }

  async undo(userId: string, id: string) {
    const row = await this.findChange(userId, id, "applied");
    if (!canUndo(row, Date.now())) {
      throw conflict("This change is too old to undo.");
    }
    return this.run(userId, storedActionsSchema.parse(row.undo), (tx, _undo, now) =>
      tx.pilotChange.update({ where: { id }, data: { status: "undone", decidedAt: now } }),
    );
  }

  private async findChange(userId: string, id: string, status: PilotChangeStatus) {
    const row = await findOwned(
      (where) => this.prisma.pilotChange.findFirst({ where }),
      { id, userId },
      "Change",
    );
    if (row.status !== status) {
      throw conflict(`This change is ${row.status}, not ${status}.`);
    }
    return row;
  }

  /** Applies the actions and writes the change row in one transaction, then publishes. */
  private async run(
    userId: string,
    actions: PilotChangeAction[],
    record: (
      tx: ActionContext["tx"] & Pick<PrismaClient, "pilotChange">,
      undo: PilotChangeAction[],
      now: Date,
    ) => Promise<PilotChangeModel>,
  ) {
    const domains = actions.flatMap((a) =>
      a.type === "search.create" && a.board ? [a.board] : [],
    );
    const boardIds = new Map<string, string | null>();
    for (const domain of new Set(domains)) {
      boardIds.set(domain, await this.boards.resolveId(domain));
    }

    const afterCommit: (() => void)[] = [];
    const row = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const undo = await applyActions({ tx, userId, now, boardIds, afterCommit }, actions);
      // Any edit can change what the pilot should do next.
      await tx.pilotState.updateMany({ where: { userId }, data: TASK_LIST_SNAPSHOT_RESET });
      return record(tx, undo, now);
    });

    for (const publishLater of afterCommit) publishLater();
    if (actions.some((a) => STATE_ACTIONS.includes(a.type))) {
      await this.pilot.publishCurrentState(userId);
    }
    return this.publishChange(row);
  }

  private publishChange(row: PilotChangeModel) {
    const change = toPilotChange(row);
    publish(pilotChannel, { userId: row.userId }, { type: "change.updated", change });
    return change;
  }
}

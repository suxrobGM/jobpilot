import type { UpdatePilotInstructionsInput } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { conflict } from "@/common/errors";
import { publish } from "@/common/sse";
import { type PilotState as PilotStateModel, PrismaClient } from "@/generated/prisma/client";
import { AGENDA_SNAPSHOT_RESET } from "./agenda/snapshot";
import { readPilotActivity } from "./pilot.activity";
import {
  parseInstructionsConfig,
  readInstructionsImpact,
  retireForNewGoals,
} from "./pilot.instructions";
import { toPilotState } from "./pilot.mapper";
import { costByKind, countAppliedToday, countSentToday, countTodayOutcomes } from "./stats";

/** Owns Pilot state, instructions and the activity/stats reads. Questions live in their own service. */
@singleton()
export class PilotService {
  constructor(private readonly prisma: PrismaClient) {}

  private async toStateDto(userId: string, row: PilotStateModel) {
    const config = parseInstructionsConfig(row.instructionsConfig);
    const now = new Date();
    const [appliedToday, networkingSentToday] = await Promise.all([
      countAppliedToday(this.prisma, userId, now),
      countSentToday(this.prisma, userId, now),
    ]);
    return toPilotState(row, appliedToday, networkingSentToday, config);
  }

  /** Every state write publishes, so the web's card and the terminal see the same row. */
  private async publishState(userId: string, row: PilotStateModel) {
    const state = await this.toStateDto(userId, row);
    publish(pilotChannel, { userId }, { type: "state.changed", state });
    return state;
  }

  /** Create-on-first-read: every profile has exactly one PilotState, defaulted. */
  async getState(userId: string) {
    const row = await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return this.toStateDto(userId, row);
  }

  private async readGoals(userId: string): Promise<string> {
    const row = await this.prisma.pilotState.findUnique({
      where: { userId },
      select: { instructionsGoals: true },
    });
    return row?.instructionsGoals ?? "";
  }

  instructionsImpact(userId: string) {
    return readInstructionsImpact(this.prisma, userId);
  }

  async updateInstructions(userId: string, body: UpdatePilotInstructionsInput) {
    // The searches were chosen for the old goals - a change makes them all due and clears backoff.
    const goalsChanged = (await this.readGoals(userId)) !== body.goals;

    const instructions = {
      instructionsGoals: body.goals,
      instructionsConfig: body.config,
      instructionsUpdatedAt: new Date(),
      ...AGENDA_SNAPSHOT_RESET,
    };
    const row = await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId, ...instructions },
      update: instructions,
    });
    // Skipped when the searches are about to be deleted below - the rows would not survive it.
    if (goalsChanged && !body.onChange.rederiveSearches) {
      await this.prisma.pilotSearch.updateMany({
        where: { userId },
        data: { emptyRuns: 0, nextRunAt: new Date() },
      });
    }
    await retireForNewGoals(this.prisma, userId, body.onChange);

    return this.publishState(userId, row);
  }

  /** Start the loop. Goals are mandatory: the pilot has nothing to steer by without them. */
  async start(userId: string) {
    if ((await this.readGoals(userId)).trim() === "") {
      throw conflict("Write the pilot's goals before starting it.");
    }
    return this.setRunning(userId, true);
  }

  /** Stop the loop. Never guards - a stopped pilot injects zero cycles. */
  stop(userId: string) {
    return this.setRunning(userId, false);
  }

  /** Clears run history only; instructions, searches and the running flag survive. */
  async reset(userId: string) {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.pilotJournalEntry.deleteMany({ where: { userId } });
      return tx.pilotState.upsert({
        where: { userId },
        create: { userId },
        update: { cycleCount: 0, lastCycleAt: null, ...AGENDA_SNAPSHOT_RESET },
      });
    });
    return this.publishState(userId, row);
  }

  private async setRunning(userId: string, running: boolean) {
    const row = await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId, running },
      update: { running, ...AGENDA_SNAPSHOT_RESET },
    });
    return this.publishState(userId, row);
  }

  /** Today's skipped/failed counts and bucketed skip reasons - the "why so few applies?" answer. */
  getTodayOutcomes(userId: string) {
    return countTodayOutcomes(this.prisma, userId, new Date());
  }

  /** Which agenda kinds ate the week - the ranking to tune the agent against. */
  async getCost(userId: string) {
    return { items: await costByKind(this.prisma, userId, new Date()) };
  }

  /** Newest persisted activity lets the terminal distinguish a slow live cycle from a stuck one. */
  getActivity(userId: string) {
    return readPilotActivity(this.prisma, userId);
  }
}

import { ErrorCodes } from "@jobpilot/contracts/errors";
import type { PilotStep } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import { conflict, findOwned } from "@/common/errors";
import { publish } from "@/common/sse";
import { PrismaClient } from "@/generated/prisma/client";

const STEPS_PER_RUN = 100;
const RUNS_KEPT = 500;

interface StepInput {
  at: string;
  label: string;
}

/**
 * Steps live in memory only: they are a live view, the API is one container, and the run's
 * result line is what stays.
 */
@injectable()
export class StepService {
  // Insertion order doubles as age, so the oldest run is the first key.
  private readonly byRun = new Map<string, PilotStep[]>();

  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  async append(userId: string, runId: string, input: StepInput[]) {
    const run = await this.findRun(userId, runId);
    if (run.finishedAt) {
      throw conflict("Run is already finished.", ErrorCodes.PILOT_CONFLICT);
    }

    const earlier = this.byRun.get(runId) ?? [];
    const next = (earlier.at(-1)?.id ?? 0) + 1;
    const steps = input.map((step, i) => ({
      id: next + i,
      at: new Date(step.at),
      label: step.label,
    }));
    const kept = [...earlier, ...steps].slice(-STEPS_PER_RUN);
    this.byRun.delete(runId);
    this.byRun.set(runId, kept);
    if (this.byRun.size > RUNS_KEPT) {
      const [oldest] = this.byRun.keys();
      this.byRun.delete(oldest);
    }
    publish(pilotChannel, { userId }, { type: "run.steps", runId, steps });
    return { ok: true as const };
  }

  /** For a viewer who joins mid-run; empty once the API restarts. */
  async list(userId: string, runId: string) {
    await this.findRun(userId, runId);
    return this.byRun.get(runId) ?? [];
  }

  private findRun(userId: string, id: string) {
    return findOwned(
      (where) => this.prisma.pilotRun.findFirst({ where, select: { finishedAt: true } }),
      { id, userId },
      "Run",
    );
  }
}

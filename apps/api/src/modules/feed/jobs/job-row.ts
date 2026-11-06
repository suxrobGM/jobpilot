import { jobBriefSchema } from "@jobpilot/contracts/feed";
import type { Prisma } from "@/generated/prisma/client";
import { BOARD_REF_SELECT } from "@/modules/job-board/job-board.service";

/** A feed job as every response and SSE event carries it: with its board, not a bare id. */
export const JOB_INCLUDE = {
  board: { select: BOARD_REF_SELECT },
} satisfies Prisma.JobInclude;

export type JobRow = Prisma.JobGetPayload<{ include: typeof JOB_INCLUDE }>;

const storedBriefSchema = jobBriefSchema.nullable();

/** The row with its brief read through the brief schema, as responses and events carry it. */
export function toJob<T extends { brief: Prisma.JsonValue }>(row: T) {
  return { ...row, brief: storedBriefSchema.parse(row.brief) };
}

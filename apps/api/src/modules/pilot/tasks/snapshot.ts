import { Prisma } from "@/generated/prisma/client";

/**
 * Drops the cached task list so the next fetch rebuilds it. Only config writes carry it
 * (instructions, searches, start/stop); job and inbox changes wait out the snapshot's TTL.
 */
export const TASK_LIST_SNAPSHOT_RESET = {
  taskListVersion: null,
  taskListExpiresAt: null,
  taskListSnapshot: Prisma.DbNull,
} as const;

/** {@link TASK_LIST_SNAPSHOT_RESET} as its own write, for edits made outside the state row. */
export function dropTaskList(db: Pick<Prisma.TransactionClient, "pilotState">, userId: string) {
  return db.pilotState.updateMany({ where: { userId }, data: TASK_LIST_SNAPSHOT_RESET });
}

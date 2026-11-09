import { pilotConfigSchema } from "@jobpilot/contracts/pilot";
import { toInputJson } from "@/common/json";
import type { Prisma } from "@/generated/prisma/client";
import { TASK_LIST_SNAPSHOT_RESET } from "./tasks/snapshot";

/** An unlinked board leaves the matching rotations: the searcher only opens linked boards. */
export async function dropFromRotation(
  tx: Prisma.TransactionClient,
  where: Prisma.PilotStateWhereInput,
  domain: string,
) {
  const states = await tx.pilotState.findMany({
    where: { ...where, config: { path: ["boards"], array_contains: [domain] } },
    select: { userId: true, config: true },
  });
  for (const state of states) {
    const config = pilotConfigSchema.parse(state.config);
    const boards = config.boards.filter((board) => board !== domain);
    await tx.pilotState.update({
      where: { userId: state.userId },
      data: { config: toInputJson({ ...config, boards }), ...TASK_LIST_SNAPSHOT_RESET },
    });
  }
}

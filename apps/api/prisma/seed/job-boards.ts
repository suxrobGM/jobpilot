import { db } from "@/common/database/prisma.client";
import { DEFAULT_BOARDS } from "@/modules/job-board/default-boards";

/** Upsert the global catalog by domain. `listed`/`isDefault` are admin-owned, so never updated. */
export async function seedJobBoards(): Promise<void> {
  // Batched: one round-trip over the tunnel instead of one per board.
  await db.$transaction(
    DEFAULT_BOARDS.map((board) =>
      db.jobBoard.upsert({
        where: { domain: board.domain },
        create: { ...board, listed: true },
        update: { name: board.name, searchUrl: board.searchUrl, sortOrder: board.sortOrder },
      }),
    ),
  );
  console.log(`✅ Board catalog: ${await db.jobBoard.count()} board(s).`);
}

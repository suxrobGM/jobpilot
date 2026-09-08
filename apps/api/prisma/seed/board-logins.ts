import { CryptoService, SECRET_CONTEXTS } from "@/common/crypto";
import { db } from "@/common/database/prisma.client";
import { container } from "@/common/di/container";

/** The retired AEAD tag of the dropped `user_job_boards.password` column. */
const BOARD_PASSWORD_CONTEXT = "board:password";

interface BoardLoginRow {
  user_id: string;
  domain: string;
  email: string | null;
  password: string | null;
}

/**
 * One-time move of per-board logins into `credentials` (scope = the board's domain). Reads the
 * old columns through raw SQL because the generated client no longer knows them. A board login
 * used to outrank a domain credential, so it overwrites one. Run BEFORE applying migration
 * 20260908000000, which drops the columns; a second run finds nothing to move.
 */
export async function moveBoardLogins(): Promise<void> {
  const crypto = container.resolve(CryptoService);
  const rows = await db.$queryRaw<BoardLoginRow[]>`
    SELECT l."user_id", b."domain", l."email", l."password"
    FROM "user_job_boards" l
    JOIN "job_boards" b ON b."id" = l."job_board_id"
    WHERE l."email" IS NOT NULL OR l."password" IS NOT NULL
  `;

  let moved = 0;
  for (const row of rows) {
    const password = row.password
      ? await crypto.encryptFor(
          row.user_id,
          SECRET_CONTEXTS.credentialPassword,
          await crypto.decryptFor(row.user_id, BOARD_PASSWORD_CONTEXT, row.password),
        )
      : null;
    await db.credential.upsert({
      where: { userId_scope: { userId: row.user_id, scope: row.domain } },
      create: { userId: row.user_id, scope: row.domain, email: row.email, password },
      update: { email: row.email, password },
    });
    moved += 1;
  }
  console.log(`✅ Board logins: ${moved} moved into credentials.`);
}

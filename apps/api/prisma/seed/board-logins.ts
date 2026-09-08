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

  const moves = await Promise.all(
    rows.map(async (row) => {
      const plain = await crypto.decryptField(row.user_id, BOARD_PASSWORD_CONTEXT, row.password);
      const password = await crypto.encryptField(
        row.user_id,
        SECRET_CONTEXTS.credentialPassword,
        plain,
      );
      return { userId: row.user_id, scope: row.domain, email: row.email, password };
    }),
  );
  await db.$transaction(
    moves.map((move) =>
      db.credential.upsert({
        where: { userId_scope: { userId: move.userId, scope: move.scope } },
        create: move,
        update: { email: move.email, password: move.password },
      }),
    ),
  );
  console.log(`✅ Board logins: ${rows.length} moved into credentials.`);
}

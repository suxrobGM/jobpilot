import "server-only";
import { db } from "@/server/db";

/** Where a resolved login came from — also the target to persist a refreshed password to. */
export type CredentialSource = "board" | "domain" | "default";

export interface ResolvedCredential {
  email: string;
  password: string;
  /** "board" → PATCH /api/job-boards/<id>; "domain"/"default" → PATCH /api/credentials/<id>. */
  source: CredentialSource;
  /** The board domain (board/domain matches) or "default". */
  scope: string;
}

/** A row with both login fields present, trimmed — or null if either is blank. */
const loginOf = (
  row: { email: string | null; password: string | null } | null | undefined,
): { email: string; password: string } | null => {
  const email = row?.email?.trim();
  const password = row?.password?.trim();
  return email && password ? { email, password } : null;
};

/**
 * Resolve the effective login for a board domain, applying the documented precedence:
 * per-board override → credential scoped to the domain → credential scoped to "default".
 * Returns `null` when no stage yields a complete email + password pair.
 */
export async function resolveCredential(
  profileId: number,
  domain: string,
): Promise<ResolvedCredential | null> {
  const board = loginOf(
    await db.jobBoard.findFirst({
      where: { profileId, domain },
      select: { email: true, password: true },
    }),
  );
  if (board) {
    return { ...board, source: "board", scope: domain };
  }

  const creds = await db.credential.findMany({
    where: { profileId, scope: { in: [domain, "default"] } },
    select: { scope: true, email: true, password: true },
  });

  const domainCred = loginOf(creds.find((c) => c.scope === domain));
  if (domainCred) {
    return { ...domainCred, source: "domain", scope: domain };
  }

  const defaultCred = loginOf(creds.find((c) => c.scope === "default"));
  if (defaultCred) {
    return { ...defaultCred, source: "default", scope: "default" };
  }

  return null;
}

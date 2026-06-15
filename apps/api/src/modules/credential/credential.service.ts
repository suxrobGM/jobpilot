import type { CredentialInput, CredentialPatch } from "@jobpilot/contracts/credential";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import { PrismaClient } from "@/generated/prisma/client";

/** Where a resolved login came from — also the target to persist a refreshed password to. */
export type CredentialSource = "board" | "domain" | "default";

export interface ResolvedCredential {
  email: string;
  password: string;
  /** "board" → PATCH /job-boards/<id>; "domain"/"default" → PATCH /credentials/<id>. */
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

@singleton()
export class CredentialService {
  constructor(private readonly prisma: PrismaClient) {}

  list(profileId: number) {
    return this.prisma.credential.findMany({ where: { profileId }, orderBy: { scope: "asc" } });
  }

  create(profileId: number, input: CredentialInput) {
    return this.prisma.credential.create({ data: { ...input, profileId } });
  }

  private findCredential(profileId: number, id: number) {
    return findOwned(
      (where) => this.prisma.credential.findFirst({ where, select: { id: true } }),
      { id, profileId },
      "Credential",
    );
  }

  async update(profileId: number, id: number, patch: CredentialPatch) {
    await this.findCredential(profileId, id);
    return this.prisma.credential.update({ where: { id }, data: patch });
  }

  async remove(profileId: number, id: number) {
    await this.findCredential(profileId, id);
    await this.prisma.credential.delete({ where: { id } });
    return { deleted: id };
  }

  /**
   * Resolve the effective login for a board domain, applying the documented precedence:
   * per-board override → credential scoped to the domain → credential scoped to "default".
   * Returns `null` when no stage yields a complete email + password pair.
   */
  async resolveCredential(profileId: number, domain: string): Promise<ResolvedCredential | null> {
    const board = loginOf(
      await this.prisma.jobBoard.findFirst({
        where: { profileId, domain },
        select: { email: true, password: true },
      }),
    );
    if (board) {
      return { ...board, source: "board", scope: domain };
    }

    const creds = await this.prisma.credential.findMany({
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
}

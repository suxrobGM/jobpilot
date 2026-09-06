import type { CredentialInput, CredentialPatch } from "@jobpilot/contracts/credential";
import { singleton } from "tsyringe";
import { CryptoService, SECRET_CONTEXTS } from "@/common/crypto";
import { findOwned } from "@/common/errors";
import { PrismaClient } from "@/generated/prisma/client";

/** Where a resolved login came from - also the target to persist a refreshed password to. */
type CredentialSource = "board" | "domain" | "default";

export interface ResolvedCredential {
  email: string;
  password: string;
  /** "board" → PATCH /job-boards/<id>; "domain"/"default" → PATCH /credentials/<id>. */
  source: CredentialSource;
  /** The board domain (board/domain matches) or "default". */
  scope: string;
}

@singleton()
export class CredentialService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly crypto: CryptoService,
  ) {}

  private async decryptRow<T extends { password: string | null; apiKey: string | null }>(
    userId: string,
    row: T,
  ): Promise<T> {
    return {
      ...row,
      password: await this.crypto.decryptField(
        userId,
        SECRET_CONTEXTS.credentialPassword,
        row.password,
      ),
      apiKey: await this.crypto.decryptField(userId, SECRET_CONTEXTS.credentialApiKey, row.apiKey),
    };
  }

  /** Unpaginated: an account stores a handful of logins, keyed by board domain plus a default. */
  async list(userId: string) {
    const rows = await this.prisma.credential.findMany({
      where: { userId },
      orderBy: { scope: "asc" },
    });
    return Promise.all(rows.map((row) => this.decryptRow(userId, row)));
  }

  async create(userId: string, input: CredentialInput) {
    const row = await this.prisma.credential.create({
      data: {
        userId,
        scope: input.scope,
        email: input.email,
        password: await this.crypto.encryptField(
          userId,
          SECRET_CONTEXTS.credentialPassword,
          input.password,
        ),
        apiKey: await this.crypto.encryptField(
          userId,
          SECRET_CONTEXTS.credentialApiKey,
          input.apiKey,
        ),
      },
    });
    return this.decryptRow(userId, row);
  }

  private findCredential(userId: string, id: string) {
    return findOwned(
      (where) => this.prisma.credential.findFirst({ where, select: { id: true } }),
      { id, userId },
      "Credential",
    );
  }

  async update(userId: string, id: string, patch: CredentialPatch) {
    await this.findCredential(userId, id);
    const row = await this.prisma.credential.update({
      where: { id },
      data: {
        scope: patch.scope,
        email: patch.email,
        password: await this.crypto.encryptField(
          userId,
          SECRET_CONTEXTS.credentialPassword,
          patch.password,
        ),
        apiKey: await this.crypto.encryptField(
          userId,
          SECRET_CONTEXTS.credentialApiKey,
          patch.apiKey,
        ),
      },
    });
    return this.decryptRow(userId, row);
  }

  async remove(userId: string, id: string) {
    await this.findCredential(userId, id);
    await this.prisma.credential.delete({ where: { id } });
    return { deleted: id };
  }

  /** A row with both login fields present and the password decrypted - or null. */
  private async toLogin(
    userId: string,
    row: { email: string | null; password: string | null } | null | undefined,
    ctx: string,
  ): Promise<{ email: string; password: string } | null> {
    const email = row?.email?.trim();
    const stored = row?.password?.trim();
    if (!email || !stored) {
      return null;
    }
    const password = (await this.crypto.decryptFor(userId, ctx, stored)).trim();
    return password ? { email, password } : null;
  }

  /**
   * Resolve the effective login for a board domain, applying the documented precedence:
   * per-board override → credential scoped to the domain → credential scoped to "default".
   * Returns `null` when no stage yields a complete email + password pair.
   */
  async resolveCredential(userId: string, domain: string): Promise<ResolvedCredential | null> {
    const board = await this.toLogin(
      userId,
      await this.prisma.userJobBoard.findFirst({
        where: { userId, jobBoard: { domain } },
        select: { email: true, password: true },
      }),
      SECRET_CONTEXTS.boardPassword,
    );
    if (board) {
      return { ...board, source: "board", scope: domain };
    }

    const creds = await this.prisma.credential.findMany({
      where: { userId, scope: { in: [domain, "default"] } },
      select: { scope: true, email: true, password: true },
    });

    const domainCred = await this.toLogin(
      userId,
      creds.find((c) => c.scope === domain),
      SECRET_CONTEXTS.credentialPassword,
    );
    if (domainCred) {
      return { ...domainCred, source: "domain", scope: domain };
    }

    const defaultCred = await this.toLogin(
      userId,
      creds.find((c) => c.scope === "default"),
      SECRET_CONTEXTS.credentialPassword,
    );
    if (defaultCred) {
      return { ...defaultCred, source: "default", scope: "default" };
    }

    return null;
  }
}

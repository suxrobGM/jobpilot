import type { CredentialInput, CredentialPatch } from "@jobpilot/contracts/credential";
import { singleton } from "tsyringe";
import { CryptoService, SECRET_CONTEXTS } from "@/common/crypto";
import { findOwned } from "@/common/errors";
import { PrismaClient } from "@/generated/prisma/client";

export interface ResolvedCredential {
  /** The credential row - the target for `PATCH /credentials/<id>` after a password reset. */
  id: string;
  email: string;
  password: string;
  /** The board domain that matched, or "default". */
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
    row: { email: string | null; password: string | null },
  ): Promise<{ email: string; password: string } | null> {
    const email = row.email?.trim();
    const stored = row.password?.trim();
    if (!email || !stored) {
      return null;
    }
    const password = (
      await this.crypto.decryptFor(userId, SECRET_CONTEXTS.credentialPassword, stored)
    ).trim();
    return password ? { email, password } : null;
  }

  /**
   * Resolve the effective login for a board domain: the credential scoped to the domain, else the
   * one scoped to "default". Returns `null` when neither holds a complete email + password pair.
   */
  async resolveCredential(userId: string, domain: string): Promise<ResolvedCredential | null> {
    const creds = await this.prisma.credential.findMany({
      where: { userId, scope: { in: [domain, "default"] } },
      select: { id: true, scope: true, email: true, password: true },
    });

    for (const scope of [domain, "default"]) {
      const cred = creds.find((c) => c.scope === scope);
      if (!cred) {
        continue;
      }
      const login = await this.toLogin(userId, cred);
      if (login) {
        return { id: cred.id, ...login, scope };
      }
    }

    return null;
  }
}

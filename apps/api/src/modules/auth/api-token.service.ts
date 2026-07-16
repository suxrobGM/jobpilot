import type { ApiTokenCreateInput } from "@jobpilot/contracts";
import { singleton } from "tsyringe";
import { type AuthUser, generateOpaqueToken, hashToken } from "@/common/auth";
import { CryptoService, KeyUnrecoverableError, SECRET_CONTEXTS } from "@/common/crypto";
import { notFound } from "@/common/errors";
import { logger } from "@/common/logger";
import { PrismaClient } from "@/generated/prisma/client";
import { principal } from "./auth.mapper";

const TERMINAL_TOKEN_NAME = "terminal";

/** Agent personal access tokens (PATs): long-lived bearer tokens for the local agent. */
@singleton()
export class ApiTokenService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly crypto: CryptoService,
  ) {}

  /** Project a token row + its raw value into the minted-token response shape. */
  private minted(row: { id: string; name: string; createdAt: Date }, token: string) {
    return { id: row.id, name: row.name, token, createdAt: row.createdAt };
  }

  async mint(userId: string, input: ApiTokenCreateInput) {
    const raw = generateOpaqueToken();
    const created = await this.prisma.apiToken.create({
      data: { userId, name: input.name, tokenHash: hashToken(raw) },
    });
    // The raw token is shown exactly once - the terminal stores it.
    return this.minted(created, raw);
  }

  /** The user's single reusable terminal token (raw stored encrypted in `tokenCipher`), provisioned on first use. */
  async getOrCreateTerminalToken(userId: string) {
    const existing = await this.prisma.apiToken.findFirst({
      where: { userId, tokenCipher: { not: null }, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (existing?.tokenCipher && (!existing.expiresAt || existing.expiresAt > new Date())) {
      try {
        const token = await this.crypto.decryptFor(
          userId,
          SECRET_CONTEXTS.apiTokenTerminal,
          existing.tokenCipher,
        );
        return this.minted(existing, token);
      } catch (error) {
        // A dead DEK can't be re-minted (encryptFor unwraps the same DEK); only a corrupt cipher is.
        if (error instanceof KeyUnrecoverableError) {
          throw error;
        }
        logger.warn({ err: error, userId }, "Terminal token cipher undecryptable; rotating");
        await this.prisma.apiToken.update({
          where: { id: existing.id },
          data: { revokedAt: new Date() },
        });
      }
    }

    return this.mintTerminalToken(userId);
  }

  private async mintTerminalToken(userId: string) {
    const raw = generateOpaqueToken();
    const created = await this.prisma.apiToken.create({
      data: {
        userId,
        name: TERMINAL_TOKEN_NAME,
        tokenHash: hashToken(raw),
        tokenCipher: await this.crypto.encryptFor(userId, SECRET_CONTEXTS.apiTokenTerminal, raw),
      },
    });
    return this.minted(created, raw);
  }

  list(userId: string) {
    return this.prisma.apiToken.findMany({
      where: { userId, revokedAt: null },
      select: { id: true, name: true, lastUsedAt: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async revoke(userId: string, id: string): Promise<{ ok: true }> {
    const token = await this.prisma.apiToken.findFirst({ where: { id, userId } });
    if (!token) {
      throw notFound("Token not found");
    }
    await this.prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  /** Used by authGuard: resolve a PAT to its user, bumping lastUsedAt. */
  async verify(raw: string): Promise<AuthUser | null> {
    const record = await this.prisma.apiToken.findUnique({
      where: { tokenHash: hashToken(raw) },
      include: { user: true },
    });
    if (!record || record.revokedAt || (record.expiresAt && record.expiresAt < new Date())) {
      return null;
    }
    void this.prisma.apiToken
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
    return principal(record.user);
  }
}

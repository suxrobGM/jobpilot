import { inject, injectable } from "@needle-di/core";
import { type AuthUser, generateOpaqueToken, hashToken } from "@/common/auth";
import { CryptoService, KeyUnrecoverableError, SECRET_CONTEXTS } from "@/common/crypto";
import { DAY_MS } from "@/common/date/buckets";
import { logger } from "@/common/logger";
import { env } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";

/** `lastUsedAt` feeds only the admin activity column, so a write per request buys nothing. */
const LAST_USED_THROTTLE_MS = 5 * 60_000;

/** Web sessions and the local agent's terminal token: every bearer credential the API accepts. */
@injectable()
export class AuthTokenService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly crypto = inject(CryptoService),
  ) {}

  /** A new web session; the raw token goes into the `session` cookie and is never stored. */
  async createSession(userId: string): Promise<string> {
    const raw = generateOpaqueToken();
    await this.prisma.authToken.create({
      data: {
        userId,
        kind: "session",
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + env.SESSION_TTL_DAYS * DAY_MS),
      },
    });
    return raw;
  }

  /** The user's single reusable terminal token (raw stored encrypted in `encryptedToken`), provisioned on first use. */
  async getOrCreateTerminalToken(userId: string) {
    const existing = await this.prisma.authToken.findFirst({
      where: { userId, kind: "terminal", revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (existing?.encryptedToken) {
      try {
        const token = await this.crypto.decryptFor(
          userId,
          SECRET_CONTEXTS.apiTokenTerminal,
          existing.encryptedToken,
        );
        return { id: existing.id, token, createdAt: existing.createdAt };
      } catch (error) {
        // A dead DEK can't be re-minted (encryptFor unwraps the same DEK); only a corrupt cipher is.
        if (error instanceof KeyUnrecoverableError) {
          throw error;
        }
        logger.warn({ err: error, userId }, "Terminal token cipher undecryptable; rotating");
        await this.prisma.authToken.update({
          where: { id: existing.id },
          data: { revokedAt: new Date() },
        });
      }
    }

    const raw = generateOpaqueToken();
    const created = await this.prisma.authToken.create({
      data: {
        userId,
        kind: "terminal",
        tokenHash: hashToken(raw),
        encryptedToken: await this.crypto.encryptFor(userId, SECRET_CONTEXTS.apiTokenTerminal, raw),
      },
    });
    return { id: created.id, token: raw, createdAt: created.createdAt };
  }

  /** The principal behind a raw session or terminal token, or null when unknown, revoked or expired. */
  async verify(raw: string): Promise<AuthUser | null> {
    const record = await this.prisma.authToken.findUnique({
      where: { tokenHash: hashToken(raw) },
      select: {
        id: true,
        kind: true,
        revokedAt: true,
        expiresAt: true,
        lastUsedAt: true,
        user: { select: { id: true, role: true, email: true } },
      },
    });
    const now = new Date();
    if (!record || record.revokedAt || (record.expiresAt && record.expiresAt <= now)) {
      return null;
    }
    const stale =
      !record.lastUsedAt || now.getTime() - record.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS;
    if (stale) {
      void this.prisma.authToken
        .update({ where: { id: record.id }, data: { lastUsedAt: now } })
        .catch(() => {});
    }
    return { ...record.user, tokenId: record.id, tokenKind: record.kind };
  }

  /** Ends the session behind a raw cookie token; a missing or unknown token is a no-op. */
  async revoke(raw: string): Promise<void> {
    await this.prisma.authToken.updateMany({
      where: { tokenHash: hashToken(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Signs out every web session except `exceptTokenId`; the terminal token survives (the host has it
   * on disk). Returns the PrismaPromise so callers compose it inside `$transaction`.
   */
  revokeSessions(userId: string, exceptTokenId?: string) {
    return this.prisma.authToken.updateMany({
      where: {
        userId,
        kind: "session",
        revokedAt: null,
        ...(exceptTokenId && { id: { not: exceptTokenId } }),
      },
      data: { revokedAt: new Date() },
    });
  }

  /** Revokes every token, terminal included - for account takeover paths. Composes in `$transaction`. */
  revokeAll(userId: string) {
    return this.prisma.authToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

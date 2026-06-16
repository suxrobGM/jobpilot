import type { ApiTokenCreateInput } from "@jobpilot/contracts";
import { singleton } from "tsyringe";
import { generateOpaqueToken, hashToken, type AuthUser } from "@/common/auth";
import { notFound } from "@/common/errors";
import { PrismaClient } from "@/generated/prisma/client";
import { principal } from "./auth.mapper";

/** Agent personal access tokens (PATs): long-lived bearer tokens for the local agent. */
@singleton()
export class ApiTokenService {
  constructor(private readonly prisma: PrismaClient) {}

  async mint(userId: string, input: ApiTokenCreateInput) {
    const raw = generateOpaqueToken();
    const created = await this.prisma.apiToken.create({
      data: { userId, name: input.name, tokenHash: hashToken(raw) },
    });
    // The raw token is shown exactly once — the terminal stores it.
    return { id: created.id, name: created.name, token: raw, createdAt: created.createdAt };
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

import type { ApiTokenCreateInput, LoginInput, RegisterInput } from "@jobpilot/contracts";
import { singleton } from "tsyringe";
import type { AuthUser } from "@/common/auth";
import {
  durationToMs,
  generateOpaqueToken,
  hashPassword,
  hashToken,
  signAccessToken,
  verifyPassword,
} from "@/common/auth";
import { conflict, notFound, unauthorized } from "@/common/errors";
import { env } from "@/env";
import { PrismaClient, type User } from "@/generated/prisma/client";

const REFRESH_TTL_MS = durationToMs(env.REFRESH_TOKEN_EXPIRY, 30 * 86_400_000);

function principal(user: User): AuthUser {
  return { id: user.id, role: user.role, email: user.email };
}

function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

@singleton()
export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Mint an access JWT + a persisted (hashed) rotating refresh token. */
  private async issueTokens(user: User) {
    const accessToken = await signAccessToken(principal(user));
    const refreshToken = generateOpaqueToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
    return { accessToken, refreshToken };
  }

  async register(input: RegisterInput) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw conflict("Email already registered");
    }
    const passwordHash = await hashPassword(input.password);
    // Co-create the 1:1 profile (empty; onboarding populates it via PUT /api/profile)
    // so profileGuard always resolves for a registered user.
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        profile: { create: { firstName: "", lastName: "", email: input.email } },
      },
    });
    return { user: publicUser(user), ...(await this.issueTokens(user)) };
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }
    return { user: publicUser(user), ...(await this.issueTokens(user)) };
  }

  /** Validate + rotate a refresh token; revoke the old one. */
  async rotateRefresh(rawRefresh: string) {
    if (!rawRefresh) {
      throw unauthorized("Missing refresh token");
    }
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawRefresh) },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw unauthorized("Invalid or expired refresh token");
    }
    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user) {
      throw unauthorized("Invalid refresh token");
    }
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return { user: publicUser(user), ...(await this.issueTokens(user)) };
  }

  async logout(rawRefresh: string): Promise<void> {
    if (!rawRefresh) {
      return;
    }
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawRefresh), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) {
      throw notFound("User not found");
    }
    return { user: publicUser(user), profile: user.profile };
  }

  // --- Agent personal access tokens (PATs) ---

  async mintApiToken(userId: string, input: ApiTokenCreateInput) {
    const raw = generateOpaqueToken();
    const created = await this.prisma.apiToken.create({
      data: { userId, name: input.name, tokenHash: hashToken(raw) },
    });
    // The raw token is shown exactly once — the terminal stores it.
    return { id: created.id, name: created.name, token: raw, createdAt: created.createdAt };
  }

  listApiTokens(userId: string) {
    return this.prisma.apiToken.findMany({
      where: { userId, revokedAt: null },
      select: { id: true, name: true, lastUsedAt: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async revokeApiToken(userId: string, id: number): Promise<{ ok: true }> {
    const token = await this.prisma.apiToken.findFirst({ where: { id, userId } });
    if (!token) {
      throw notFound("Token not found");
    }
    await this.prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  /** Used by authGuard: resolve a PAT to its user, bumping lastUsedAt. */
  async verifyApiToken(raw: string): Promise<AuthUser | null> {
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

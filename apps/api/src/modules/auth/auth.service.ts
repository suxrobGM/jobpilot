import type { LoginInput, RegisterInput } from "@jobpilot/contracts";
import { singleton } from "tsyringe";
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
import { DEFAULT_BOARDS } from "@/modules/job-board/default-boards";
import { principal, publicUser } from "./auth.mapper";

const REFRESH_TTL_MS = durationToMs(env.REFRESH_TOKEN_EXPIRY, 30 * 86_400_000);

/** Email/password accounts and refresh-token sessions. */
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

  /** Build the standard auth response: public user + a fresh token pair. */
  private async session(user: User) {
    return { user: publicUser(user), ...(await this.issueTokens(user)) };
  }

  async register(input: RegisterInput) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw conflict("Email already registered");
    }
    const passwordHash = await hashPassword(input.password);
    // In development, skip the verification round-trip so local signups land straight
    // in the app; every other environment must confirm the address (see proxy gate).
    // The controller sends the verification email when `emailVerified` is false.
    const autoVerified = env.NODE_ENV === "development";
    // Co-create the 1:1 profile (empty; onboarding populates it via PUT /api/profile)
    // so profileGuard always resolves for a registered user. Seed the default board
    // catalog inline — Prisma fills profileId on each row from the parent create.
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        emailVerified: autoVerified,
        profile: {
          create: {
            firstName: "",
            lastName: "",
            email: input.email,
            jobBoards: { createMany: { data: DEFAULT_BOARDS } },
          },
        },
      },
    });
    return this.session(user);
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }
    return this.session(user);
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
    return this.session(user);
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
}

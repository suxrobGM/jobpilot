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
import { normalizeEmail } from "@/common/utils/email";
import { randomUsername } from "@/common/utils/username";
import { env } from "@/env";
import { PrismaClient, type User, UserRole } from "@/generated/prisma/client";
import { meUser, principal, publicUser } from "./auth.mapper";

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
  async issueSession(user: User) {
    return { user: publicUser(user), ...(await this.issueTokens(user)) };
  }

  async register(input: RegisterInput) {
    // Dev signups skip the verification round-trip; elsewhere the controller emails the link.
    const user = await this.createUserAccount({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      emailVerified: env.NODE_ENV === "development",
    });
    return this.issueSession(user);
  }

  /** Shared by password registration and OAuth signup (null hash, provider-verified email). */
  async createUserAccount(input: {
    email: string;
    passwordHash: string | null;
    emailVerified: boolean;
  }): Promise<User> {
    const email = normalizeEmail(input.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw conflict("Email already registered");
    }

    const role: UserRole = env.SUPER_ADMIN_EMAIL?.toLowerCase() === email ? "SUPER_ADMIN" : "USER";

    // An unseeded catalog yields zero links rather than a failed signup.
    const defaults = await this.prisma.jobBoard.findMany({
      where: { isDefault: true },
      select: { id: true },
    });

    try {
      return await this.prisma.user.create({
        data: {
          email,
          passwordHash: input.passwordHash,
          role,
          emailVerified: input.emailVerified,
          username: await this.uniqueUsername(),
          contactEmail: email,
          jobBoards: {
            createMany: { data: defaults.map((board) => ({ jobBoardId: board.id })) },
          },
        },
      });
    } catch (error) {
      // Concurrent signup slipped past the pre-check; keep the friendly message.
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        throw conflict("Email already registered");
      }
      throw error;
    }
  }

  /** A random username not already taken. The unique constraint is the final backstop. */
  private async uniqueUsername(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const candidate = randomUsername();
      const taken = await this.prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    return `pilot-${crypto.randomUUID().slice(0, 8)}`;
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(input.email) },
    });
    // Null hash = OAuth-only account; the generic message keeps that unenumerable.
    if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }
    return this.issueSession(user);
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
    return this.issueSession(user);
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
      include: { oauthAccounts: { select: { provider: true } } },
      // One joined statement - the proxy hits /me on every gated navigation.
      relationLoadStrategy: "join",
    });
    if (!user) {
      throw notFound("User not found");
    }
    return meUser(user);
  }
}

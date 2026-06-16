import type { ApiTokenCreateInput, LoginInput, RegisterInput } from "@jobpilot/contracts";
import { createElement } from "react";
import { inject, singleton } from "tsyringe";
import type { AuthUser } from "@/common/auth";
import {
  durationToMs,
  generateOpaqueToken,
  hashPassword,
  hashToken,
  signAccessToken,
  verifyPassword,
} from "@/common/auth";
import { badRequest, conflict, notFound, unauthorized } from "@/common/errors";
import { logger } from "@/common/logger";
import {
  MAILER,
  PasswordResetEmail,
  passwordResetEmailSubject,
  VerificationEmail,
  verificationEmailSubject,
  type Mailer,
} from "@/common/mail";
import { env } from "@/env";
import { PrismaClient, VerificationTokenType, type User } from "@/generated/prisma/client";

const REFRESH_TTL_MS = durationToMs(env.REFRESH_TOKEN_EXPIRY, 30 * 86_400_000);
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

function principal(user: User): AuthUser {
  return { id: user.id, role: user.role, email: user.email };
}

function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
  };
}

@singleton()
export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    @inject(MAILER) private readonly mailer: Mailer,
  ) {}

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
    // In development, skip the verification round-trip so local signups land straight
    // in the app; every other environment must confirm the address (see proxy gate).
    const autoVerified = env.NODE_ENV === "development";
    // Co-create the 1:1 profile (empty; onboarding populates it via PUT /api/profile)
    // so profileGuard always resolves for a registered user.
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        emailVerified: autoVerified,
        profile: { create: { firstName: "", lastName: "", email: input.email } },
      },
    });
    if (!autoVerified) {
      // Best-effort: a mail outage shouldn't block account creation. The user can
      // re-trigger the email from the verify-email gate.
      try {
        await this.sendVerificationEmail(user.id, user.email);
      } catch (error) {
        logger.error({ err: error, userId: user.id }, "Failed to send verification email");
      }
    }
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

  // --- Email verification & password reset ---

  /** Issue a single-use, expiring token of the given type; only its hash is stored. */
  private async issueVerificationToken(
    userId: string,
    type: VerificationTokenType,
    ttlMs: number,
  ): Promise<string> {
    const raw = generateOpaqueToken();
    // Supersede any prior unconsumed token of the same type so only the latest link works.
    await this.prisma.verificationToken.deleteMany({ where: { userId, type, consumedAt: null } });
    await this.prisma.verificationToken.create({
      data: { userId, type, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + ttlMs) },
    });
    return raw;
  }

  /** Look up a valid (right type, unconsumed, unexpired) token or throw. */
  private async findValidToken(rawToken: string, type: VerificationTokenType) {
    if (!rawToken) {
      throw badRequest("Missing token");
    }
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!record || record.type !== type || record.consumedAt || record.expiresAt < new Date()) {
      throw badRequest("Invalid or expired token");
    }
    return record;
  }

  private async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const raw = await this.issueVerificationToken(
      userId,
      VerificationTokenType.EMAIL_VERIFICATION,
      EMAIL_VERIFICATION_TTL_MS,
    );
    const link = `${env.APP_URL}/verify-email?token=${raw}`;
    await this.mailer.send({
      to: email,
      subject: verificationEmailSubject,
      react: createElement(VerificationEmail, { link }),
    });
  }

  /** Confirm an email address from a verification magic link. */
  async verifyEmail(rawToken: string): Promise<{ ok: true }> {
    const record = await this.findValidToken(rawToken, VerificationTokenType.EMAIL_VERIFICATION);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  /** Re-send the verification email for the signed-in user (the verify-email gate). */
  async resendVerification(userId: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw notFound("User not found");
    }
    if (!user.emailVerified) {
      await this.sendVerificationEmail(user.id, user.email);
    }
    return { ok: true };
  }

  /** Send a password-reset link. Always succeeds — never reveals whether the email exists. */
  async requestPasswordReset(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const raw = await this.issueVerificationToken(
        user.id,
        VerificationTokenType.PASSWORD_RESET,
        PASSWORD_RESET_TTL_MS,
      );
      const link = `${env.APP_URL}/reset-password?token=${raw}`;
      await this.mailer.send({
        to: user.email,
        subject: passwordResetEmailSubject,
        react: createElement(PasswordResetEmail, { link }),
      });
    }
    return { ok: true };
  }

  /** Set a new password from a reset magic link and revoke existing sessions. */
  async resetPassword(rawToken: string, newPassword: string): Promise<{ ok: true }> {
    const record = await this.findValidToken(rawToken, VerificationTokenType.PASSWORD_RESET);
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      // Force re-login everywhere — a reset implies the old sessions may be compromised.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
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

  async revokeApiToken(userId: string, id: string): Promise<{ ok: true }> {
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

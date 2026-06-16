import { createElement } from "react";
import { inject, singleton } from "tsyringe";
import { generateOpaqueToken, hashPassword, hashToken } from "@/common/auth";
import { badRequest, notFound } from "@/common/errors";
import {
  MAILER,
  PasswordResetEmail,
  passwordResetEmailSubject,
  VerificationEmail,
  verificationEmailSubject,
  type Mailer,
} from "@/common/mail";
import { env } from "@/env";
import { PrismaClient, VerificationTokenType } from "@/generated/prisma/client";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Magic-link flows built on single-use `VerificationToken`s: email confirmation
 * and password reset. Only token hashes are stored; the raw token travels in the
 * emailed link.
 */
@singleton()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaClient,
    @inject(MAILER) private readonly mailer: Mailer,
  ) {}

  /** Issue a single-use, expiring token of the given type; only its hash is stored. */
  private async issueToken(
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

  /** Send (or re-send) the email-confirmation magic link. */
  async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const raw = await this.issueToken(
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
      const raw = await this.issueToken(
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
}

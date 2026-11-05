import { inject, injectable } from "@needle-di/core";
import { createElement } from "react";
import { generateOpaqueToken, hashPassword, hashToken } from "@/common/auth";
import { badRequest, conflict, notFound } from "@/common/errors";
import {
  EmailChangeEmail,
  emailChangeEmailSubject,
  MAILER,
  PasswordResetEmail,
  passwordResetEmailSubject,
  VerificationEmail,
  verificationEmailSubject,
} from "@/common/mail";
import { normalizeEmail } from "@/common/utils/email";
import { env } from "@/env";
import { PrismaClient, VerificationTokenType } from "@/generated/prisma/client";
import { AuthTokenService } from "./auth-token.service";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Magic-link flows built on single-use `VerificationToken`s: email confirmation,
 * password reset, and email change. Only token hashes are stored; the raw token
 * travels in the emailed link.
 */
@injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly mailer = inject(MAILER),
    private readonly tokens = inject(AuthTokenService),
  ) {}

  /** Issue a single-use, expiring token; only its hash is stored. */
  private async issueToken(
    userId: string,
    type: VerificationTokenType,
    ttlMs: number,
    newEmail?: string,
  ): Promise<string> {
    const raw = generateOpaqueToken();
    // Supersede any prior unconsumed token of the same type so only the latest link works.
    await this.prisma.verificationToken.deleteMany({ where: { userId, type, consumedAt: null } });
    await this.prisma.verificationToken.create({
      data: {
        userId,
        type,
        tokenHash: hashToken(raw),
        newEmail,
        expiresAt: new Date(Date.now() + ttlMs),
      },
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
      VerificationTokenType.email_verification,
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
    const record = await this.findValidToken(rawToken, VerificationTokenType.email_verification);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
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
    if (user.emailVerifiedAt === null) {
      await this.sendVerificationEmail(user.id, user.email);
    }
    return { ok: true };
  }

  /** Send a password-reset link. Always succeeds - never reveals whether the email exists. */
  async requestPasswordReset(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    if (user) {
      const raw = await this.issueToken(
        user.id,
        VerificationTokenType.password_reset,
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
    const record = await this.findValidToken(rawToken, VerificationTokenType.password_reset);
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      // Force re-login everywhere - a reset implies the old sessions may be compromised.
      this.tokens.revokeAll(record.userId),
    ]);
    return { ok: true };
  }

  /** Mail an email-change confirmation link to the NEW address. */
  async sendEmailChangeEmail(userId: string, newEmail: string): Promise<void> {
    const raw = await this.issueToken(
      userId,
      VerificationTokenType.email_change,
      EMAIL_CHANGE_TTL_MS,
      newEmail,
    );
    const link = `${env.APP_URL}/confirm-email-change?token=${raw}`;
    await this.mailer.send({
      to: newEmail,
      subject: emailChangeEmailSubject,
      react: createElement(EmailChangeEmail, { link }),
    });
  }

  /** The link from the new mailbox switches the login email and forces re-login. */
  async confirmEmailChange(rawToken: string): Promise<{ ok: true }> {
    const record = await this.findValidToken(rawToken, VerificationTokenType.email_change);
    if (!record.newEmail) {
      throw badRequest("Invalid or expired token");
    }
    // The address may have been registered since the request.
    const taken = await this.prisma.user.findUnique({
      where: { email: record.newEmail },
      select: { id: true },
    });

    if (taken) {
      throw conflict("Email already in use");
    }

    await this.prisma.$transaction([
      // Clicking the link proves control of the new mailbox, so it arrives verified.
      this.prisma.user.update({
        where: { id: record.userId },
        data: { email: record.newEmail, emailVerifiedAt: new Date() },
      }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      // The login identifier changed - force re-login everywhere.
      this.tokens.revokeSessions(record.userId),
    ]);
    return { ok: true };
  }
}

import type { ChangeEmailInput, ChangePasswordInput } from "@jobpilot/contracts/auth";
import { inject, injectable } from "@needle-di/core";
import { hashPassword, verifyPassword } from "@/common/auth";
import { badRequest, conflict, notFound, unauthorized } from "@/common/errors";
import { normalizeEmail } from "@/common/utils/email";
import { PrismaClient } from "@/generated/prisma/client";
import { AuthTokenService } from "./auth-token.service";
import { VerificationService } from "./verification.service";

/** Password change/set and the email-change request gate. Never touches `encryptedDataKey`. */
@injectable()
export class SecurityService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly verification = inject(VerificationService),
    private readonly tokens = inject(AuthTokenService),
  ) {}

  /** Verify the current password when the account has one; OAuth-only accounts skip it. */
  private async requireCurrentPassword(
    passwordHash: string | null,
    currentPassword: string | undefined,
  ): Promise<void> {
    if (passwordHash === null) {
      return;
    }
    if (!currentPassword) {
      throw badRequest("Current password is required");
    }
    if (!(await verifyPassword(currentPassword, passwordHash))) {
      throw unauthorized("Current password is incorrect");
    }
  }

  /** Change or first-set the password; revokes every session except the caller's. */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    currentTokenId: string,
  ): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) {
      throw notFound("User not found");
    }
    await this.requireCurrentPassword(user.passwordHash, input.currentPassword);

    const passwordHash = await hashPassword(input.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.tokens.revokeSessions(userId, currentTokenId),
    ]);
    return { ok: true };
  }

  /** Gate an email change, then mail the confirmation link; nothing switches until clicked. */
  async requestEmailChange(userId: string, input: ChangeEmailInput): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, passwordHash: true },
    });
    if (!user) {
      throw notFound("User not found");
    }
    await this.requireCurrentPassword(user.passwordHash, input.currentPassword);

    const newEmail = normalizeEmail(input.newEmail);
    if (newEmail === user.email) {
      throw badRequest("This is already your sign-in email");
    }
    const taken = await this.prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });
    if (taken) {
      throw conflict("Email already in use");
    }

    await this.verification.sendEmailChangeEmail(userId, newEmail);
    return { ok: true };
  }
}

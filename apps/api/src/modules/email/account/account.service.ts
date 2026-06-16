import { randomBytes } from "node:crypto";
import type { SendEmailInput } from "@jobpilot/contracts/outreach";
import { singleton } from "tsyringe";
import { badRequest, ErrorCodes, HttpError } from "@/common/errors";
import { PrismaClient } from "@/generated/prisma/client";
import { accountCanSend, getProvider } from "../gmail.provider";
import { loadFreshAccount } from "./account.utils";

@singleton()
export class EmailAccountService {
  constructor(private readonly prisma: PrismaClient) {}

  async accountStatus(profileId: number) {
    const account = await this.prisma.emailAccount.findUnique({ where: { profileId } });

    if (!account) {
      return { connected: false, canSend: false };
    }

    return {
      connected: true,
      provider: account.provider,
      email: account.email,
      lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
      canSend: accountCanSend(account),
    };
  }

  async disconnectAccount(profileId: number) {
    await this.prisma.emailAccount.deleteMany({ where: { profileId } });
    return { disconnected: true };
  }

  /**
   * Send an outbound email from the profile's connected mailbox. Used by the
   * outreach skill (and the outreach board's "approve & send" action). Refreshes
   * an expired token first and 4xxs with an actionable message when the account
   * lacks send scope (needs reconnecting).
   */
  async send(profileId: number, body: SendEmailInput) {
    const account = await loadFreshAccount(this.prisma, profileId);
    if (!account) {
      throw new HttpError(ErrorCodes.NOT_FOUND, "No email account connected", 404);
    }
    if (!accountCanSend(account)) {
      throw new HttpError(
        ErrorCodes.UNPROCESSABLE,
        "Connected mailbox lacks send access. Reconnect it from email settings to enable sending.",
        422,
      );
    }

    try {
      return await getProvider(account.provider).sendMessage(account, {
        to: body.to,
        subject: body.subject,
        body: body.body,
        threadId: body.threadId,
        attachments: body.attachments,
      });
    } catch (e) {
      throw new HttpError(
        ErrorCodes.UNPROCESSABLE,
        e instanceof Error ? e.message : "Failed to send message",
        502,
      );
    }
  }

  buildAuthorizeUrl(providerName: string): { authorizeUrl: string; state: string } {
    if (providerName !== "gmail") {
      throw badRequest(`Unsupported provider: ${providerName}`);
    }

    const state = randomBytes(16).toString("hex");
    let authorizeUrl: string;
    try {
      authorizeUrl = getProvider(providerName).getAuthorizeUrl(state);
    } catch (e) {
      throw new HttpError(
        ErrorCodes.UNPROCESSABLE,
        e instanceof Error ? e.message : "Email provider unavailable",
        400,
      );
    }

    return { authorizeUrl, state };
  }

  async completeEmailOAuth(input: {
    providerName: string;
    code: string;
    profileId: number;
  }): Promise<{ email: string }> {
    const { providerName, code, profileId } = input;
    const provider = getProvider(providerName);
    const { tokens, email } = await provider.exchangeCode(code);

    await this.prisma.emailAccount.upsert({
      where: { profileId },
      create: {
        profileId,
        provider: providerName,
        email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        tokenExpiresAt: tokens.expiresAt ?? null,
        scope: tokens.scope ?? null,
      },
      update: {
        provider: providerName,
        email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        tokenExpiresAt: tokens.expiresAt ?? null,
        scope: tokens.scope ?? null,
      },
    });

    return { email };
  }
}

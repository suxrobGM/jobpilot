import { randomBytes } from "node:crypto";
import type { SendEmailInput } from "@jobpilot/contracts/outreach";
import { singleton } from "tsyringe";
import { CryptoService, SECRET_CONTEXTS } from "@/common/crypto";
import { badRequest, ErrorCodes, HttpError } from "@/common/errors";
import { PrismaClient } from "@/generated/prisma/client";
import { accountCanSend, getProvider } from "../gmail.provider";
import { loadFreshAccount } from "./account.utils";

@singleton()
export class EmailAccountService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly crypto: CryptoService,
  ) {}

  async accountStatus(profileId: string) {
    const account = await this.prisma.emailAccount.findUnique({ where: { profileId } });

    if (!account) {
      return { connected: false as const, canSend: false };
    }

    return {
      connected: true as const,
      provider: account.provider,
      email: account.email,
      lastSyncAt: account.lastSyncAt,
      canSend: accountCanSend(account),
    };
  }

  async disconnectAccount(profileId: string) {
    await this.prisma.emailAccount.deleteMany({ where: { profileId } });
    return { disconnected: true };
  }

  /**
   * Send an outbound email from the profile's connected mailbox. Used by the
   * outreach skill (and the outreach board's "approve & send" action). Refreshes
   * an expired token first and 4xxs with an actionable message when the account
   * lacks send scope (needs reconnecting).
   */
  async send(userId: string, profileId: string, body: SendEmailInput) {
    const account = await loadFreshAccount(this.prisma, this.crypto, userId, profileId);
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
    userId: string;
    profileId: string;
  }): Promise<{ email: string }> {
    const { providerName, code, userId, profileId } = input;
    const provider = getProvider(providerName);
    const { tokens, email } = await provider.exchangeCode(code);

    const accessToken = await this.crypto.encryptFor(
      userId,
      SECRET_CONTEXTS.gmailTokens,
      tokens.accessToken,
    );
    const refreshToken =
      (await this.crypto.encryptField(userId, SECRET_CONTEXTS.gmailTokens, tokens.refreshToken)) ??
      null;
    const fields = {
      provider: providerName,
      email,
      accessToken,
      refreshToken,
      tokenExpiresAt: tokens.expiresAt ?? null,
      scope: tokens.scope ?? null,
    };

    await this.prisma.emailAccount.upsert({
      where: { profileId },
      create: { profileId, ...fields },
      update: fields,
    });

    return { email };
  }
}

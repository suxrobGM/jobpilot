import { randomBytes } from "node:crypto";
import type { EmailProvider, OAuthClientUpsertInput } from "@jobpilot/contracts/email";
import type { SendEmailInput } from "@jobpilot/contracts/networking";
import { singleton } from "tsyringe";
import { CryptoService, SECRET_CONTEXTS } from "@/common/crypto";
import { badRequest, conflict, ErrorCodes, HttpError, unprocessable } from "@/common/errors";
import { env } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";
import {
  accountCanSend,
  GMAIL_READ_SCOPE,
  GMAIL_SCOPES,
  getProvider,
  scopeCanRead,
} from "../gmail.provider";
import { loadFreshAccount, resolveOAuthClient } from "./account.utils";

@singleton()
export class EmailAccountService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly crypto: CryptoService,
  ) {}

  async accountStatus(userId: string) {
    const account = await this.prisma.emailAccount.findUnique({ where: { userId } });

    if (!account) {
      return { connected: false as const, canSend: false };
    }

    return {
      connected: true as const,
      provider: account.provider,
      email: account.email,
      lastSyncAt: account.lastSyncAt,
      canSend: accountCanSend(account),
      needsReauth: account.refreshFailedAt !== null,
    };
  }

  async disconnectAccount(userId: string) {
    await this.prisma.emailAccount.deleteMany({ where: { userId } });
    return { disconnected: true };
  }

  /**
   * Send an outbound email from the user's connected mailbox. Used by the
   * networking skill (and the networking board's "approve & send" action). Refreshes
   * an expired token first and 4xxs with an actionable message when the account
   * lacks send scope (needs reconnecting).
   */
  async send(userId: string, body: SendEmailInput) {
    const loaded = await loadFreshAccount(this.prisma, this.crypto, userId);
    if (!loaded) {
      throw new HttpError(ErrorCodes.NOT_FOUND, "No email account connected", 404);
    }
    const { account, config } = loaded;
    if (!accountCanSend(account)) {
      throw new HttpError(
        ErrorCodes.UNPROCESSABLE,
        "Connected mailbox lacks send access. Reconnect it from email settings to enable sending.",
        422,
      );
    }

    try {
      return await getProvider(account.provider).sendMessage(config, account, {
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

  async buildAuthorizeUrl(
    userId: string,
    providerName: EmailProvider,
  ): Promise<{ authorizeUrl: string; state: string }> {
    if (providerName !== "gmail") {
      throw badRequest(`Unsupported provider: ${providerName}`);
    }

    const config = await resolveOAuthClient(this.prisma, this.crypto, userId);
    const state = randomBytes(16).toString("hex");
    let authorizeUrl: string;
    try {
      authorizeUrl = getProvider(providerName).getAuthorizeUrl(config, state);
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
    providerName: EmailProvider;
    code: string;
    userId: string;
  }): Promise<{ email: string }> {
    const { providerName, code, userId } = input;
    const provider = getProvider(providerName);
    const config = await resolveOAuthClient(this.prisma, this.crypto, userId);
    const { tokens, email } = await provider.exchangeCode(config, code);

    // Granular consent can drop a scope silently; storing that grant 403s every later sync.
    if (!scopeCanRead(tokens.scope)) {
      throw unprocessable(
        `Google did not grant ${GMAIL_READ_SCOPE}. Reconnect and allow every requested permission.`,
      );
    }

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
      // A reconnect is exactly how a dead grant gets fixed.
      refreshFailedAt: null,
    };

    await this.prisma.emailAccount.upsert({
      where: { userId },
      create: { userId, ...fields },
      update: fields,
    });

    return { email };
  }

  // ── OAuth client config (bring-your-own Google app) ─────────────────────────

  /** Config status for the email settings UI. Never returns the client secret. */
  async getOAuthClient(userId: string) {
    const row = await this.prisma.emailOAuthClient.findUnique({ where: { userId } });
    return {
      configured: row !== null,
      provider: row?.provider ?? "gmail",
      clientId: row?.clientId ?? null,
      redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
      scopes: GMAIL_SCOPES,
    };
  }

  /** Create/update the client; a blank clientSecret keeps the stored one (required on first create). */
  async upsertOAuthClient(userId: string, input: OAuthClientUpsertInput) {
    const provider = input.provider ?? "gmail";
    if (provider !== "gmail") {
      throw badRequest(`Unsupported provider: ${provider}`);
    }

    const existing = await this.prisma.emailOAuthClient.findUnique({ where: { userId } });
    const plainSecret = input.clientSecret?.trim();

    let clientSecret: string;
    if (plainSecret) {
      clientSecret = await this.crypto.encryptFor(
        userId,
        SECRET_CONTEXTS.emailOAuthClient,
        plainSecret,
      );
    } else if (existing) {
      clientSecret = existing.clientSecret;
    } else {
      throw badRequest("Client secret is required");
    }

    await this.prisma.emailOAuthClient.upsert({
      where: { userId },
      create: { userId, provider, clientId: input.clientId, clientSecret },
      update: { provider, clientId: input.clientId, clientSecret },
    });

    return this.getOAuthClient(userId);
  }

  /** Remove the OAuth client. Blocked while a mailbox is still connected. */
  async deleteOAuthClient(userId: string) {
    const account = await this.prisma.emailAccount.findUnique({ where: { userId } });
    if (account) {
      throw conflict("Disconnect the mailbox before removing its OAuth client.");
    }
    await this.prisma.emailOAuthClient.deleteMany({ where: { userId } });
    return { deleted: true };
  }
}

import { randomBytes } from "node:crypto";
import type { EmailConnectErrorReason, OAuthClientUpsertInput } from "@jobpilot/contracts/email";
import type { SendEmailInput } from "@jobpilot/contracts/networking";
import { inject, injectable } from "@needle-di/core";
import { OAuthFlowError } from "@/common/auth";
import { CryptoService, SECRET_CONTEXTS } from "@/common/crypto";
import { badGateway, badRequest, conflict, notFound, unprocessable } from "@/common/errors";
import { env } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";
import { GMAIL_SCOPES, GmailClient, scopeCanRead, scopeCanSend } from "../gmail.client";
import type { ExchangedCode } from "../gmail.types";
import { MailboxSessionService } from "./mailbox-session.service";

@injectable()
export class EmailAccountService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly crypto = inject(CryptoService),
    private readonly sessions = inject(MailboxSessionService),
    private readonly gmail = inject(GmailClient),
  ) {}

  async accountStatus(userId: string) {
    const account = await this.prisma.emailAccount.findUnique({ where: { userId } });

    if (!account) {
      return { connected: false as const, canSend: false };
    }

    return {
      connected: true as const,
      email: account.email,
      lastSyncAt: account.lastSyncAt,
      canSend: scopeCanSend(account.scope),
      needsReauth: account.refreshFailedAt !== null,
    };
  }

  async disconnectAccount(userId: string) {
    await this.prisma.emailAccount.deleteMany({ where: { userId } });
    return { ok: true as const };
  }

  /** Refreshes an expired token first; 422s when the mailbox lacks send scope (reconnect it). */
  async send(userId: string, body: SendEmailInput) {
    const mailbox = await this.sessions.open(userId);
    if (!mailbox) {
      throw notFound("No email account connected");
    }
    if (!scopeCanSend(mailbox.account.scope)) {
      throw unprocessable(
        "Connected mailbox lacks send access. Reconnect it from email settings to enable sending.",
      );
    }

    try {
      return await this.gmail.send(mailbox.session, body);
    } catch (e) {
      throw badGateway(e instanceof Error ? e.message : "Failed to send message");
    }
  }

  async buildAuthorizeUrl(userId: string): Promise<{ authorizeUrl: string; state: string }> {
    const config = await this.sessions.resolveOAuthClient(userId);
    const state = randomBytes(16).toString("hex");
    return { authorizeUrl: this.gmail.authorizeUrl(config, state), state };
  }

  async completeEmailOAuth(userId: string, code: string): Promise<{ email: string }> {
    const config = await this.sessions.resolveOAuthClient(userId);
    let exchanged: ExchangedCode;
    try {
      exchanged = await this.gmail.exchangeCode(config, code);
    } catch (cause) {
      throw new OAuthFlowError<EmailConnectErrorReason>("provider_error", { cause });
    }
    const { tokens, email } = exchanged;

    // Granular consent can drop a scope silently; storing that grant 403s every later sync.
    if (!scopeCanRead(tokens.scope)) {
      throw new OAuthFlowError<EmailConnectErrorReason>("scope_not_granted");
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
      email,
      accessToken,
      refreshToken,
      tokenExpiresAt: tokens.expiresAt ?? null,
      scope: tokens.scope ?? null,
      // A reconnect is exactly how a dead grant gets fixed.
      refreshFailedAt: null,
      // Restart from a recent-mail list; mail missed while the grant was dead is past the old cursor.
      historyId: null,
    };

    await this.prisma.emailAccount.upsert({
      where: { userId },
      create: { userId, ...fields },
      update: fields,
    });

    return { email };
  }

  async getOAuthClient(userId: string) {
    const row = await this.prisma.emailOAuthClient.findUnique({ where: { userId } });
    return {
      configured: row !== null,
      clientId: row?.clientId ?? null,
      redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
      scopes: GMAIL_SCOPES,
    };
  }

  /** A blank clientSecret keeps the stored one; it is required on first create. */
  async upsertOAuthClient(userId: string, input: OAuthClientUpsertInput) {
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
      create: { userId, clientId: input.clientId, clientSecret },
      update: { clientId: input.clientId, clientSecret },
    });

    return this.getOAuthClient(userId);
  }

  async deleteOAuthClient(userId: string) {
    const account = await this.prisma.emailAccount.findUnique({ where: { userId } });
    if (account) {
      throw conflict("Disconnect the mailbox before removing its OAuth client.");
    }
    await this.prisma.emailOAuthClient.deleteMany({ where: { userId } });
    return { ok: true as const };
  }
}

import { createHash, randomBytes } from "node:crypto";
import type {
  EmailConnectErrorReason,
  EmailProvider,
  OAuthClientUpsertInput,
} from "@jobpilot/contracts/email";
import type { SendEmailInput } from "@jobpilot/contracts/networking";
import { inject, injectable } from "@needle-di/core";
import { OAuthFlowError } from "@/common/auth";
import { CryptoService, SECRET_CONTEXTS } from "@/common/crypto";
import {
  badGateway,
  badRequest,
  conflict,
  HttpError,
  notFound,
  unprocessable,
} from "@/common/errors";
import { env } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";
import type { ExchangedCode, OAuthClientConfig } from "../email.types";
import { EmailProviders, mailboxCanRead, mailboxCanSend, tokenContext } from "../email-provider";
import { GMAIL_SCOPES } from "../gmail.client";
import { microsoftScopes } from "../microsoft.client";
import { MailboxSessionService } from "./mailbox-session.service";

function configHash(config: OAuthClientConfig): string {
  return createHash("sha256").update(JSON.stringify(config)).digest("hex");
}

@injectable()
export class EmailAccountService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly crypto = inject(CryptoService),
    private readonly sessions = inject(MailboxSessionService),
    private readonly providers = inject(EmailProviders),
  ) {}

  async accountStatus(userId: string) {
    const account = await this.prisma.emailAccount.findUnique({ where: { userId } });
    if (!account) {
      return { connected: false as const, canSend: false };
    }
    const microsoftConfig =
      account.provider === "microsoft"
        ? await this.prisma.emailOAuthClient.findUnique({
            where: { userId_provider: { userId, provider: "microsoft" } },
          })
        : null;
    return {
      connected: true as const,
      email: account.email,
      provider: account.provider,
      signedInEmail: account.signedInEmail,
      lastSyncAt: account.lastSyncAt,
      canSend:
        (account.provider !== "microsoft" || !!microsoftConfig?.allowSend) &&
        mailboxCanSend(account.provider, account.scope, !!account.mailboxId),
      needsReauth: account.refreshFailedAt !== null,
    };
  }

  async disconnectAccount(userId: string) {
    await this.prisma.emailAccount.deleteMany({ where: { userId } });
    return { ok: true as const };
  }

  async send(userId: string, body: SendEmailInput) {
    const mailbox = await this.sessions.open(userId);
    if (!mailbox) {
      throw notFound("No email account connected");
    }
    if (
      !mailboxCanSend(mailbox.account.provider, mailbox.account.scope, !!mailbox.account.mailboxId)
    ) {
      throw unprocessable(
        "Connected mailbox lacks send access. Reconnect it with sending enabled.",
      );
    }
    try {
      return await this.providers.send(mailbox.account.provider, mailbox.session, body);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw badGateway("The email provider could not send this message.");
    }
  }

  async buildAuthorizeUrl(userId: string, provider: EmailProvider = "gmail") {
    const active = await this.prisma.emailAccount.findUnique({ where: { userId } });
    if (active && active.provider !== provider) {
      throw conflict("Disconnect the current mailbox before connecting another provider.");
    }
    const config = await this.sessions.resolveOAuthClient(userId, provider);
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    return {
      authorizeUrl: this.providers.authorizeUrl(provider, config, state, verifier),
      state,
      verifier,
      configHash: configHash(config),
    };
  }

  async completeEmailOAuth(
    userId: string,
    code: string,
    provider: EmailProvider = "gmail",
    verifier = "",
    expectedConfigHash?: string,
  ): Promise<{ email: string }> {
    const config = await this.sessions.resolveOAuthClient(userId, provider);
    if (!expectedConfigHash || configHash(config) !== expectedConfigHash) {
      throw new OAuthFlowError<EmailConnectErrorReason>("invalid_callback");
    }
    let exchanged: ExchangedCode;
    try {
      exchanged = await this.providers.exchangeCode(provider, config, code, verifier);
    } catch (error) {
      if (error instanceof OAuthFlowError) {
        throw error;
      }
      if (provider === "microsoft" && error instanceof HttpError && error.status === 403) {
        throw new OAuthFlowError<EmailConnectErrorReason>("mailbox_access_denied");
      }
      throw new OAuthFlowError<EmailConnectErrorReason>("provider_error");
    }
    const { tokens, email } = exchanged;
    if (!mailboxCanRead(provider, tokens.scope, !!exchanged.mailboxId)) {
      throw new OAuthFlowError<EmailConnectErrorReason>("scope_not_granted");
    }
    const existing = await this.prisma.emailAccount.findUnique({ where: { userId } });
    if (
      existing &&
      (existing.provider !== provider ||
        existing.email.toLowerCase() !== email.toLowerCase() ||
        (existing.signedInEmail !== null && existing.signedInEmail !== exchanged.signedInEmail))
    ) {
      throw conflict("Disconnect the current mailbox before changing the connected identity.");
    }
    const fields = {
      provider,
      email,
      signedInEmail: exchanged.signedInEmail ?? null,
      mailboxId: exchanged.mailboxId ?? null,
      accessToken: await this.crypto.encryptFor(userId, tokenContext(provider), tokens.accessToken),
      refreshToken: await this.crypto.encryptField(
        userId,
        tokenContext(provider),
        tokens.refreshToken,
      ),
      tokenExpiresAt: tokens.expiresAt ?? null,
      scope: tokens.scope ?? null,
      refreshFailedAt: null,
    };
    // Create instead of upsert: racing OAuth callbacks must not replace a different mailbox.
    if (existing) {
      await this.prisma.emailAccount.update({ where: { id: existing.id }, data: fields });
    } else {
      await this.prisma.emailAccount.create({ data: { userId, ...fields } });
    }
    return { email };
  }

  async getOAuthClient(userId: string, provider: EmailProvider = "gmail") {
    const row = await this.prisma.emailOAuthClient.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    const config = {
      clientId: row?.clientId ?? "",
      clientSecret: "",
      redirectUri:
        provider === "microsoft" ? env.MICROSOFT_OAUTH_REDIRECT_URI : env.GOOGLE_OAUTH_REDIRECT_URI,
      tenantId: row?.tenantId ?? null,
      mailbox: row?.mailbox ?? null,
      allowSend: row?.allowSend ?? false,
    };
    return {
      configured: row !== null,
      provider,
      clientId: row?.clientId ?? null,
      redirectUri: config.redirectUri,
      tenantId: config.tenantId,
      mailbox: config.mailbox,
      allowSend: config.allowSend,
      scopes: provider === "microsoft" ? microsoftScopes(config) : GMAIL_SCOPES,
    };
  }

  async upsertOAuthClient(userId: string, input: OAuthClientUpsertInput) {
    const { provider } = input;
    const where = { userId_provider: { userId, provider } };
    const existing = await this.prisma.emailOAuthClient.findUnique({ where });
    const active = await this.prisma.emailAccount.findUnique({ where: { userId } });
    const mailbox = input.mailbox?.toLowerCase() || null;
    const tenantId = input.tenantId || null;
    if (
      active?.provider === provider &&
      existing &&
      (existing.clientId !== input.clientId ||
        existing.tenantId !== tenantId ||
        existing.mailbox !== mailbox)
    ) {
      throw conflict(
        "Disconnect this mailbox before changing its OAuth client, tenant or mailbox address.",
      );
    }
    let clientSecret = existing?.clientSecret;
    if (input.clientSecret?.trim()) {
      clientSecret = await this.crypto.encryptFor(
        userId,
        SECRET_CONTEXTS.emailOAuthClient,
        input.clientSecret.trim(),
      );
    }
    if (!clientSecret) {
      throw badRequest("Client secret is required");
    }
    const fields = {
      clientId: input.clientId,
      clientSecret,
      tenantId,
      mailbox,
      allowSend: input.allowSend,
    };
    await this.prisma.emailOAuthClient.upsert({
      where,
      create: { userId, provider, ...fields },
      update: fields,
    });
    return this.getOAuthClient(userId, provider);
  }

  async deleteOAuthClient(userId: string, provider: EmailProvider = "gmail") {
    const active = await this.prisma.emailAccount.findUnique({ where: { userId } });
    if (active?.provider === provider) {
      throw conflict("Disconnect the mailbox before removing its OAuth client.");
    }
    await this.prisma.emailOAuthClient.deleteMany({ where: { userId, provider } });
    return { ok: true as const };
  }
}

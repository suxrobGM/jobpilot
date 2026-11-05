import type { EmailProvider } from "@jobpilot/contracts/email";
import { inject, injectable } from "@needle-di/core";
import { CryptoService, SECRET_CONTEXTS } from "@/common/crypto";
import { badRequest, HttpError, unauthorized } from "@/common/errors";
import { env } from "@/env";
import { type EmailAccount, PrismaClient } from "@/generated/prisma/client";
import type { MailboxSession, OAuthClientConfig, TokenSet } from "../email.types";
import { EmailProviders, tokenContext } from "../email-provider";

/** A connected mailbox: the stored row (ids, scope, sync state) and a session ready for Gmail. */
interface OpenMailbox {
  account: EmailAccount;
  session: MailboxSession;
}

@injectable()
export class MailboxSessionService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly crypto = inject(CryptoService),
    private readonly providers = inject(EmailProviders),
  ) {}

  /** The user's own Google OAuth client - there is no shared one. */
  async resolveOAuthClient(
    userId: string,
    provider: EmailProvider = "gmail",
  ): Promise<OAuthClientConfig> {
    const row = await this.prisma.emailOAuthClient.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!row) {
      throw badRequest(
        "No OAuth client configured for this provider. Add its Client ID and Secret in email settings.",
      );
    }

    const clientSecret = await this.crypto.decryptFor(
      userId,
      SECRET_CONTEXTS.emailOAuthClient,
      row.clientSecret,
    );
    return {
      clientId: row.clientId,
      clientSecret,
      redirectUri:
        provider === "microsoft" ? env.MICROSOFT_OAUTH_REDIRECT_URI : env.GOOGLE_OAUTH_REDIRECT_URI,
      tenantId: row.tenantId,
      mailbox: row.mailbox,
      allowSend: row.allowSend,
    };
  }

  /**
   * Decrypts the stored tokens and refreshes an expired access token, re-encrypting it at rest.
   * `null` when no mailbox is connected.
   */
  async open(userId: string): Promise<OpenMailbox | null> {
    const account = await this.prisma.emailAccount.findUnique({ where: { userId } });
    if (!account) {
      return null;
    }

    const decrypt = (value: string | null) =>
      this.crypto.decryptField(userId, tokenContext(account.provider), value);
    const [config, accessToken, refreshToken] = await Promise.all([
      this.resolveOAuthClient(userId, account.provider),
      decrypt(account.accessToken),
      decrypt(account.refreshToken),
    ]);
    const session: MailboxSession = {
      config,
      accessToken,
      refreshToken,
      tokenExpiresAt: account.tokenExpiresAt,
      historyId: account.historyId,
      mailboxId: account.mailboxId,
      deltaLink: account.deltaLink,
      scope: account.scope,
    };

    const expired = session.tokenExpiresAt !== null && session.tokenExpiresAt <= new Date();
    if (!session.refreshToken || !expired) {
      return { account, session };
    }
    return this.refresh(account, session, session.refreshToken);
  }

  /**
   * A rejected refresh (invalid_grant) stamps `refreshFailedAt` so status reports the mailbox needs
   * reconnecting; success clears it.
   */
  private async refresh(
    account: EmailAccount,
    session: MailboxSession,
    refreshToken: string,
  ): Promise<OpenMailbox> {
    let refreshed: TokenSet;
    try {
      refreshed = await this.providers.refresh(account.provider, session.config, refreshToken);
    } catch (error) {
      if (
        account.provider === "microsoft" &&
        (!(error instanceof HttpError) || error.status !== 401)
      )
        throw error;
      await this.prisma.emailAccount.update({
        where: { id: account.id },
        data: { refreshFailedAt: account.refreshFailedAt ?? new Date() },
      });
      throw unauthorized(
        "The mail provider rejected the mailbox token. Reconnect it from email settings.",
      );
    }

    const nextRefreshToken = refreshed.refreshToken ?? refreshToken;
    const tokenExpiresAt = refreshed.expiresAt ?? null;
    const encrypt = (value: string) =>
      this.crypto.encryptFor(account.userId, tokenContext(account.provider), value);
    const updated = await this.prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        accessToken: await encrypt(refreshed.accessToken),
        refreshToken: await encrypt(nextRefreshToken),
        tokenExpiresAt,
        scope: refreshed.scope ?? account.scope,
        refreshFailedAt: null,
      },
    });
    return {
      account: updated,
      session: {
        ...session,
        accessToken: refreshed.accessToken,
        refreshToken: nextRefreshToken,
        tokenExpiresAt,
        scope: refreshed.scope ?? account.scope,
      },
    };
  }
}

import { inject, injectable } from "@needle-di/core";
import { CryptoService, SECRET_CONTEXTS } from "@/common/crypto";
import { badRequest, unauthorized } from "@/common/errors";
import { env } from "@/env";
import { type EmailAccount, PrismaClient } from "@/generated/prisma/client";
import { GmailClient } from "../gmail.client";
import type { MailboxSession, OAuthClientConfig, TokenSet } from "../gmail.types";

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
    private readonly gmail = inject(GmailClient),
  ) {}

  /** The user's own Google OAuth client - there is no shared one. */
  async resolveOAuthClient(userId: string): Promise<OAuthClientConfig> {
    const row = await this.prisma.emailOAuthClient.findUnique({ where: { userId } });
    if (!row) {
      throw badRequest(
        "No Google OAuth client configured. Add your Client ID and Secret in email settings.",
      );
    }

    const clientSecret = await this.crypto.decryptFor(
      userId,
      SECRET_CONTEXTS.emailOAuthClient,
      row.clientSecret,
    );
    return { clientId: row.clientId, clientSecret, redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI };
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
      this.crypto.decryptField(userId, SECRET_CONTEXTS.gmailTokens, value);
    const [config, accessToken, refreshToken] = await Promise.all([
      this.resolveOAuthClient(userId),
      decrypt(account.accessToken),
      decrypt(account.refreshToken),
    ]);
    const session: MailboxSession = {
      config,
      accessToken,
      refreshToken,
      tokenExpiresAt: account.tokenExpiresAt,
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
      refreshed = await this.gmail.refresh(session.config, refreshToken);
    } catch {
      await this.prisma.emailAccount.update({
        where: { id: account.id },
        data: { refreshFailedAt: account.refreshFailedAt ?? new Date() },
      });
      throw unauthorized("Google rejected the mailbox token. Reconnect it from email settings.");
    }

    const nextRefreshToken = refreshed.refreshToken ?? refreshToken;
    const tokenExpiresAt = refreshed.expiresAt ?? null;
    const encrypt = (value: string) =>
      this.crypto.encryptFor(account.userId, SECRET_CONTEXTS.gmailTokens, value);
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
      },
    };
  }
}

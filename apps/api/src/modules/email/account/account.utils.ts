import { SECRET_CONTEXTS, type CryptoService } from "@/common/crypto";
import { ErrorCodes, HttpError } from "@/common/errors";
import { env } from "@/env";
import { type EmailAccount, type PrismaClient } from "@/generated/prisma/client";
import type { OAuthClientConfig } from "../email.provider";
import { getProvider } from "../gmail.provider";

/** Resolve the profile's own Google OAuth client; 400s if unconfigured (no shared client). Redirect URI is env-derived. */
export async function resolveOAuthClient(
  prisma: PrismaClient,
  crypto: CryptoService,
  userId: string,
  profileId: string,
): Promise<OAuthClientConfig> {
  const row = await prisma.emailOAuthClient.findUnique({ where: { profileId } });
  if (!row) {
    throw new HttpError(
      ErrorCodes.UNPROCESSABLE,
      "No Google OAuth client configured. Add your Client ID and Secret in email settings.",
      400,
    );
  }

  const clientSecret = await crypto.decryptFor(
    userId,
    SECRET_CONTEXTS.emailOAuthClient,
    row.clientSecret,
  );
  return { clientId: row.clientId, clientSecret, redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI };
}

/**
 * Load the profile's connected email account with its OAuth tokens decrypted for
 * use, refreshing the access token first when expired (and re-encrypting the
 * refreshed tokens at rest). Returns `null` when no account is connected. Shared
 * by the account (send) and sync services so neither duplicates the refresh dance.
 *
 * Returns the resolved OAuth `config` alongside the account so callers reuse it
 * instead of resolving the same row again.
 */
export async function loadFreshAccount(
  prisma: PrismaClient,
  crypto: CryptoService,
  userId: string,
  profileId: string,
): Promise<{ account: EmailAccount; config: OAuthClientConfig } | null> {
  const account = await prisma.emailAccount.findUnique({ where: { profileId } });
  if (!account) {
    return null;
  }

  const accessToken = await crypto.decryptField(
    userId,
    SECRET_CONTEXTS.gmailTokens,
    account.accessToken,
  );
  const refreshToken = await crypto.decryptField(
    userId,
    SECRET_CONTEXTS.gmailTokens,
    account.refreshToken,
  );
  const plain: EmailAccount = { ...account, accessToken, refreshToken };
  const config = await resolveOAuthClient(prisma, crypto, userId, profileId);

  const now = new Date();
  if (refreshToken && account.tokenExpiresAt && account.tokenExpiresAt <= now) {
    const provider = getProvider(account.provider);
    const refreshed = await provider.refresh(config, refreshToken);
    const newRefresh = refreshed.refreshToken ?? refreshToken;

    await prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        accessToken: await crypto.encryptFor(
          userId,
          SECRET_CONTEXTS.gmailTokens,
          refreshed.accessToken,
        ),
        refreshToken: await crypto.encryptFor(userId, SECRET_CONTEXTS.gmailTokens, newRefresh),
        tokenExpiresAt: refreshed.expiresAt ?? null,
        scope: refreshed.scope ?? account.scope,
      },
    });

    return {
      account: {
        ...plain,
        accessToken: refreshed.accessToken,
        refreshToken: newRefresh,
        tokenExpiresAt: refreshed.expiresAt ?? null,
        scope: refreshed.scope ?? account.scope,
      },
      config,
    };
  }

  return { account: plain, config };
}

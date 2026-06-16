import { SECRET_CONTEXTS, type CryptoService } from "@/common/crypto";
import { type EmailAccount, type PrismaClient } from "@/generated/prisma/client";
import { getProvider } from "../gmail.provider";

/**
 * Load the profile's connected email account with its OAuth tokens decrypted for
 * use, refreshing the access token first when expired (and re-encrypting the
 * refreshed tokens at rest). Returns `null` when no account is connected. Shared
 * by the account (send) and sync services so neither duplicates the refresh dance.
 */
export async function loadFreshAccount(
  prisma: PrismaClient,
  crypto: CryptoService,
  userId: string,
  profileId: string,
): Promise<EmailAccount | null> {
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

  const now = new Date();
  if (refreshToken && account.tokenExpiresAt && account.tokenExpiresAt <= now) {
    const provider = getProvider(account.provider);
    const refreshed = await provider.refresh(refreshToken);
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
      ...plain,
      accessToken: refreshed.accessToken,
      refreshToken: newRefresh,
      tokenExpiresAt: refreshed.expiresAt ?? null,
      scope: refreshed.scope ?? account.scope,
    };
  }

  return plain;
}

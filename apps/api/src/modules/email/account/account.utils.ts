import { type EmailAccount, type PrismaClient } from "@/generated/prisma/client";
import { getProvider } from "../gmail.provider";

/**
 * Load the profile's connected email account, refreshing its access token
 * first when expired. Returns `null` when no account is connected. Shared by the
 * account (send) and sync services so neither duplicates the refresh dance.
 */
export async function loadFreshAccount(
  prisma: PrismaClient,
  profileId: number,
): Promise<EmailAccount | null> {
  const account = await prisma.emailAccount.findUnique({ where: { profileId } });
  if (!account) {
    return null;
  }

  const now = new Date();
  if (account.refreshToken && account.tokenExpiresAt && account.tokenExpiresAt <= now) {
    const provider = getProvider(account.provider);
    const refreshed = await provider.refresh(account.refreshToken);

    return prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? account.refreshToken,
        tokenExpiresAt: refreshed.expiresAt ?? null,
        scope: refreshed.scope ?? account.scope,
      },
    });
  }

  return account;
}

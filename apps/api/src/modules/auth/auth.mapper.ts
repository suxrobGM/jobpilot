import type { OAuthProvider, Prisma, User } from "@/generated/prisma/client";
import { type PROFILE_SELECT, withProfile } from "@/modules/user/user.mapper";

/** The public-safe view of a user returned to clients. */
export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt,
  };
}

interface MeRow extends User {
  oauthAccounts: { provider: OAuthProvider }[];
  profile: Prisma.ProfileGetPayload<{ select: typeof PROFILE_SELECT }> | null;
}

/**
 * The signed-in user's own merged view (`GET /me`): account fields plus the applicant profile.
 * `contactEmail` is the applicant address; `email` stays the login address. Secrets
 * (passwordHash, encryptedDataKey) are never included.
 */
export function meUser(row: MeRow) {
  const { oauthAccounts, passwordHash, encryptedDataKey: _, ...user } = withProfile(row);
  return {
    ...user,
    ...publicUser(row),
    // Existence only - the hash itself never leaves the service layer.
    hasPassword: passwordHash !== null,
    providers: oauthAccounts.map((a) => a.provider),
  };
}

import type { AuthUser } from "@/common/auth";
import type { User } from "@/generated/prisma/client";

/** The principal carried on a request (authGuard derive, access-token subject). */
export function principal(user: User): AuthUser {
  return { id: user.id, role: user.role, email: user.email };
}

/** The public-safe view of a user returned to clients. */
export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
  };
}

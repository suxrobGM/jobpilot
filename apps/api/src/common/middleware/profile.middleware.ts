import { Elysia } from "elysia";
import type { AuthUser } from "@/common/auth";
import { db } from "@/common/database";
import { notFound, unauthorized } from "@/common/errors";
import { resolveAuthUser } from "./auth.middleware";

/**
 * Auth + the user's single profile (1:1). Self-contained (resolves the user
 * itself rather than nesting authGuard, whose scoped derive would not propagate
 * here). No cookie, no "active profile" — browser and agent resolve identically.
 */
export const profileGuard = new Elysia({ name: "profile-guard" }).derive(
  { as: "scoped" },
  async ({ headers, cookie }): Promise<{ user: AuthUser; profileId: string }> => {
    const user = await resolveAuthUser({ headers, cookie });
    if (!user) {
      throw unauthorized("Missing authorization");
    }
    const profile = await db.profile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!profile) {
      throw notFound("No profile. Complete onboarding.");
    }
    return { user, profileId: profile.id };
  },
);

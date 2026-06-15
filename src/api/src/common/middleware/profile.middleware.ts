import { Elysia } from "elysia";
import { db } from "@/common/database";
import { notFound, unauthorized } from "@/common/errors";
import { authGuard } from "./auth.middleware";

/**
 * Resolves the authenticated user's single profile (1:1). No cookie, no
 * "active profile" — the browser and the agent resolve identically.
 */
export const profileGuard = new Elysia({ name: "profile-guard" })
  .use(authGuard)
  .derive({ as: "scoped" }, async ({ user }): Promise<{ profileId: number }> => {
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
    return { profileId: profile.id };
  });

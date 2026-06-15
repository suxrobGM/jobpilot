import { Elysia } from "elysia";
import type { AuthUser } from "@/common/auth";
import { forbidden, unauthorized } from "@/common/errors";
import { resolveAuthUser } from "./auth.middleware";

/**
 * Role-based access control. Derives `user` and enforces the role in one pass
 * (self-contained, like profileGuard). `ADMIN` passes every check.
 *   someRoutes.use(requireRole("ADMIN")).get(...)
 */
export const requireRole = (...roles: string[]) =>
  new Elysia({ name: `role-${roles.join("-")}` }).derive(
    { as: "scoped" },
    async ({ headers, cookie }): Promise<{ user: AuthUser }> => {
      const user = await resolveAuthUser({ headers, cookie });
      if (!user) {
        throw unauthorized("Missing authorization");
      }
      if (user.role !== "ADMIN" && !roles.includes(user.role)) {
        throw forbidden("Insufficient permissions");
      }
      return { user };
    },
  );

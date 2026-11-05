import { hasRole, type Role } from "@jobpilot/contracts/role";
import { Elysia } from "elysia";
import type { AuthUser } from "@/common/auth";
import { forbidden, unauthorized } from "@/common/errors";
import { resolveAuthUser } from "./auth.middleware";

/** Controller-wide RBAC: `someRoutes.use(requireRole("admin"))`. super_admin satisfies everything. */
export const requireRole = (...roles: Role[]) =>
  new Elysia({ name: `role-${roles.join("-")}` }).derive(
    { as: "scoped" },
    async ({ headers, cookie }): Promise<{ user: AuthUser }> => {
      // The token lookup reads the role from the user row, so a demotion applies on the next request.
      const user = await resolveAuthUser({ headers, cookie });
      if (!user) {
        throw unauthorized("Missing authorization");
      }
      if (!roles.some((required) => hasRole(user.role, required))) {
        throw forbidden("Insufficient permissions");
      }
      return { user };
    },
  );

/**
 * Tighten one route inside a `requireRole` controller: `beforeHandle: requireRoleOn("super_admin")`.
 * A hook, not a nested plugin - a nested scoped derive would leak the check onto sibling routes.
 */
export const requireRoleOn =
  (role: Role) =>
  ({ user }: { user: AuthUser }): void => {
    if (!hasRole(user.role, role)) {
      throw forbidden("Insufficient permissions");
    }
  };

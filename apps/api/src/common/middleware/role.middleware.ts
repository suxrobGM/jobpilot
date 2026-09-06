import { hasRole, type Role } from "@jobpilot/contracts/role";
import { Elysia } from "elysia";
import type { AuthUser } from "@/common/auth";
import { db } from "@/common/database/prisma.client";
import { forbidden, unauthorized } from "@/common/errors";
import { resolveAuthUser } from "./auth.middleware";

/** Controller-wide RBAC: `someRoutes.use(requireRole("ADMIN"))`. SUPER_ADMIN satisfies everything. */
export const requireRole = (...roles: Role[]) =>
  new Elysia({ name: `role-${roles.join("-")}` }).derive(
    { as: "scoped" },
    async ({ headers, cookie }): Promise<{ user: AuthUser }> => {
      const user = await resolveAuthUser({ headers, cookie });
      if (!user) {
        throw unauthorized("Missing authorization");
      }
      const satisfies = (role: string) => roles.some((required) => hasRole(role, required));
      // Reject on the (possibly stale) JWT claim first: keeps the deny path off the DB.
      if (!satisfies(user.role)) {
        throw forbidden("Insufficient permissions");
      }
      // Confirm against the row before granting, so a demoted admin is locked out on their next
      // request rather than at token expiry. A promoted one still waits for their next refresh.
      const current = await db.user.findUnique({
        where: { id: user.id },
        select: { role: true },
      });
      if (!current || !satisfies(current.role)) {
        throw forbidden("Insufficient permissions");
      }
      return { user: { ...user, role: current.role } };
    },
  );

/**
 * Tighten one route inside a `requireRole` controller: `beforeHandle: requireRoleOn("SUPER_ADMIN")`.
 * A hook, not a nested plugin - a nested scoped derive would leak the check onto sibling routes.
 */
export const requireRoleOn =
  (role: Role) =>
  ({ user }: { user: AuthUser }): void => {
    if (!hasRole(user.role, role)) {
      throw forbidden("Insufficient permissions");
    }
  };

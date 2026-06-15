import { Elysia } from "elysia";
import { forbidden, unauthorized } from "@/common/errors";
import { authGuard } from "./auth.middleware";

/**
 * Role-based access control. `ADMIN` passes every check.
 *   someRoutes.use(requireRole("ADMIN")).get(...)
 */
export const requireRole = (...roles: string[]) =>
  new Elysia({ name: `role-${roles.join("-")}` })
    .use(authGuard)
    .onBeforeHandle({ as: "scoped" }, ({ user }) => {
      if (!user) {
        throw unauthorized("Missing authorization");
      }
      if (user.role === "ADMIN") {
        return;
      }
      if (!roles.includes(user.role)) {
        throw forbidden("Insufficient permissions");
      }
    });

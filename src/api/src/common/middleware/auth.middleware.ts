import { Elysia } from "elysia";
import type { AuthUser } from "@/common/auth";
import { verifyAccessToken } from "@/common/auth";
import { container } from "@/common/di";
import { unauthorized } from "@/common/errors";
import { AuthService } from "@/modules/auth/auth.service";

/**
 * Dual-mode auth guard. Derives `user` from an `Authorization: Bearer` token
 * (web JWT or the local agent's PAT) or the httpOnly `accessToken` cookie (web).
 */
export const authGuard = new Elysia({ name: "auth-guard" }).derive(
  { as: "scoped" },
  async ({ headers, cookie }): Promise<{ user: AuthUser }> => {
    const authorization = headers.authorization;
    const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    const cookieToken = cookie.accessToken?.value;
    const token = bearer ?? (typeof cookieToken === "string" ? cookieToken : undefined);

    if (!token) {
      throw unauthorized("Missing authorization");
    }

    const jwtUser = await verifyAccessToken(token);
    if (jwtUser) {
      return { user: jwtUser };
    }

    const apiUser = await container.resolve(AuthService).verifyApiToken(token);
    if (apiUser) {
      return { user: apiUser };
    }

    throw unauthorized("Invalid or expired token");
  },
);

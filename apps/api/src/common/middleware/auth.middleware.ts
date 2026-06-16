import { Elysia, type Cookie } from "elysia";
import { verifyAccessToken, type AuthUser } from "@/common/auth";
import { container } from "@/common/di";
import { unauthorized } from "@/common/errors";
import { ApiTokenService } from "@/modules/auth/api-token.service";

const apiTokenService = container.resolve(ApiTokenService);

interface AuthContext {
  headers: Record<string, string | undefined>;
  cookie: Record<string, Cookie<unknown> | undefined>;
}

/**
 * Resolve the principal from a request: prefer `Authorization: Bearer` (web JWT
 * or the agent's PAT), then the httpOnly `accessToken` cookie. Returns null when
 * unauthenticated. Shared by authGuard and profileGuard so neither nests the
 * other (Elysia scoped derives don't propagate into a nested derive).
 */
export async function resolveAuthUser({ headers, cookie }: AuthContext): Promise<AuthUser | null> {
  const authorization = headers.authorization;
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  const cookieToken = cookie.accessToken?.value;
  const token = bearer ?? (typeof cookieToken === "string" ? cookieToken : undefined);
  if (!token) {
    return null;
  }
  const jwtUser = await verifyAccessToken(token);
  if (jwtUser) {
    return jwtUser;
  }
  return apiTokenService.verify(token);
}

/** Derives `user`. Throws 401 when unauthenticated. */
export const authGuard = new Elysia({ name: "auth-guard" }).derive(
  { as: "scoped" },
  async ({ headers, cookie }): Promise<{ user: AuthUser }> => {
    const user = await resolveAuthUser({ headers, cookie });
    if (!user) {
      throw unauthorized("Missing authorization");
    }
    return { user };
  },
);

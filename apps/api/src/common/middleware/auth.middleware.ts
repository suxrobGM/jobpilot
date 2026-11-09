import { type Cookie, Elysia } from "elysia";
import { type AuthUser, readSessionCookie } from "@/common/auth";
import { container } from "@/common/di/container";
import { agentOutdated, unauthorized } from "@/common/errors";
import { AuthTokenService } from "@/modules/auth/auth-token.service";
import {
  AGENT_VERSION_HEADER,
  isOutdatedAgent,
  noteAgentVersion,
  OUTDATED_AGENT_MESSAGE,
} from "./agent-version";

interface AuthContext {
  headers: Record<string, string | undefined>;
  cookie: Record<string, Cookie<unknown> | undefined>;
}

/** The agent's bearer token wins over the `session` cookie. */
export async function resolveAuthUser({ headers, cookie }: AuthContext): Promise<AuthUser | null> {
  const authorization = headers.authorization;
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  const token = bearer ?? readSessionCookie(cookie);
  if (!token) {
    return null;
  }
  // Resolved per call, not at import, so a test can bind a fake before the first request.
  return container.get(AuthTokenService).verify(token);
}

/** 426 for a too-old bearer caller: it would otherwise hit removed routes and lose work silently. */
export const authGuard = new Elysia({ name: "auth-guard" }).derive(
  { as: "scoped" },
  async ({ headers, cookie }): Promise<{ user: AuthUser }> => {
    const user = await resolveAuthUser({ headers, cookie });
    if (!user) {
      throw unauthorized("Missing authorization");
    }
    if (headers.authorization?.startsWith("Bearer ")) {
      const outdated = isOutdatedAgent(headers[AGENT_VERSION_HEADER]);
      noteAgentVersion(user.id, outdated);
      if (outdated) {
        throw agentOutdated(OUTDATED_AGENT_MESSAGE);
      }
    }
    return { user };
  },
);

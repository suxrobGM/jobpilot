import type { AUTH_TOKEN_KINDS } from "@jobpilot/contracts/auth";

/** The authenticated principal derived by `authGuard` from a session or terminal token. */
export interface AuthUser {
  id: string;
  role: string;
  email: string;
  /** The `AuthToken` row that authenticated this request. */
  tokenId: string;
  /** `terminal`: the agent host or a skill, not the web. */
  tokenKind: (typeof AUTH_TOKEN_KINDS)[number];
}

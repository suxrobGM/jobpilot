import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/eden";

/** The current user + active profile, inferred from `GET /api/auth/me`. */
export type MeResponse = Data<typeof api.auth.me.get>;
export type AuthUserDto = MeResponse["user"];

/** Login/register response (tokens are ignored — auth rides the httpOnly cookie). */
export type AuthSessionResponse = Data<typeof api.auth.login.post>;

export type LogoutResponse = Data<typeof api.auth.logout.post>;

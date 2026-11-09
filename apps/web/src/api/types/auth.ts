import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

/** The current user (flat: account + profile fields), inferred from `GET /api/auth/me`. */
export type AuthUserDto = Data<typeof api.auth.me.get>;

/** Login/register response: the user. The session rides the httpOnly cookie. */
export type AuthSessionResponse = Data<typeof api.auth.login.post>;

export type LogoutResponse = Data<typeof api.auth.logout.post>;
export type DeleteAccountResponse = Data<typeof api.auth.account.delete>;

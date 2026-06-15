export interface AuthUserDto {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
}

/** `GET /api/auth/me` — the current user plus their active profile (if any). */
export interface MeResponse {
  user: AuthUserDto;
  profile: unknown | null;
}

/** `POST /api/auth/login` and `POST /api/auth/register` — tokens are ignored; auth rides the httpOnly cookie. */
export interface AuthSessionResponse {
  user: AuthUserDto;
  accessToken: string;
  refreshToken: string;
}

export interface LogoutResponse {
  ok: boolean;
}

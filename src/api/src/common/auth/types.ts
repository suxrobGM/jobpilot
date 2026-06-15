/** The authenticated principal derived by `authGuard` (web JWT or agent PAT). */
export interface AuthUser {
  id: string;
  role: string;
  email: string;
}

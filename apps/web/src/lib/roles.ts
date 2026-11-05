import { hasRole } from "@jobpilot/contracts/role";

/** Cosmetic only - `requireRole` is the real gate. Lives here so the edge proxy avoids MUI. */
export function isAdminRole(role: string | undefined): boolean {
  return hasRole(role, "admin");
}

import { z } from "zod/v4";

/** Every role the system knows. super_admin is a seed-granted singleton. */
export const ROLES = ["super_admin", "admin", "user"] as const;
export const roleSchema = z.enum(ROLES);

/** The subset an API caller may assign - what makes super_admin unreachable over HTTP. */
export const assignableRoleSchema = z.enum(["admin", "user"]);

export type Role = z.infer<typeof roleSchema>;
export type AssignableRole = z.infer<typeof assignableRoleSchema>;

/** Privilege ladder: a higher rank satisfies every lower requirement. */
const RANK: Record<Role, number> = { user: 0, admin: 1, super_admin: 2 };

/**
 * Does `actual` satisfy `required`? Shared by the API guard and the web nav, so the ladder is
 * defined once. `actual` is a raw string (from the request principal): anything off the ladder fails.
 */
export function hasRole(actual: string | undefined, required: Role): boolean {
  const rank = RANK[actual as Role];
  return rank !== undefined && rank >= RANK[required];
}

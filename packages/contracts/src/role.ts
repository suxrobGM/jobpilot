import { z } from "zod/v4";

/** Every role the system knows. SUPER_ADMIN is a seed-granted singleton. */
export const ROLES = ["SUPER_ADMIN", "ADMIN", "USER"] as const;
export const roleSchema = z.enum(ROLES);

/** The subset an API caller may assign - what makes SUPER_ADMIN unreachable over HTTP. */
export const assignableRoleSchema = z.enum(["ADMIN", "USER"]);

export type Role = z.infer<typeof roleSchema>;
export type AssignableRole = z.infer<typeof assignableRoleSchema>;

/** Privilege ladder: a higher rank satisfies every lower requirement. */
const RANK: Record<Role, number> = { USER: 0, ADMIN: 1, SUPER_ADMIN: 2 };

/**
 * Does `actual` satisfy `required`? Shared by the API guard and the web nav, so the ladder is
 * defined once. `actual` is a raw string (an untrusted JWT claim): anything off the ladder fails.
 */
export function hasRole(actual: string | undefined, required: Role): boolean {
  const rank = RANK[actual as Role];
  return rank !== undefined && rank >= RANK[required];
}

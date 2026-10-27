import { z } from "zod/v4";
import { paginationQuerySchema, queryText } from "./pagination";
import { assignableRoleSchema, roleSchema } from "./role";

export const adminUserQuerySchema = paginationQuerySchema.extend({
  search: queryText.optional(),
  role: roleSchema.optional(),
});

export const updateUserRoleSchema = z.object({ role: assignableRoleSchema });

/** Page controls for the admin Pilot-fleet view. */
export const adminPilotQuerySchema = paginationQuerySchema;

export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;
export type AdminPilotQuery = z.infer<typeof adminPilotQuerySchema>;

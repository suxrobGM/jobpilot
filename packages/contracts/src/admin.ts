import { z } from "zod/v4";
import { assignableRoleSchema, roleSchema } from "./role";

export const adminUserQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  role: roleSchema.optional(),
});

export const updateUserRoleSchema = z.object({ role: assignableRoleSchema });

/** Page controls for the admin Pilot-fleet view. */
export const adminPilotQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type AdminPilotQuery = z.infer<typeof adminPilotQuerySchema>;

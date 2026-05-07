import { z } from "zod/v4";

export const jobBoardSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  searchUrl: z.string().optional().nullable(),
  type: z.enum(["search", "ats"]),
  enabled: z.boolean(),
  email: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  sortOrder: z.number().int(),
});

export type JobBoardInput = z.infer<typeof jobBoardSchema>;

export const jobBoardPatchSchema = jobBoardSchema.partial();
export type JobBoardPatch = z.infer<typeof jobBoardPatchSchema>;

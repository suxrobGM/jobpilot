import { z } from "zod/v4";

export const coverLetterSourceSchema = z.enum(["apply", "auto-apply", "manual"]).default("manual");

export const coverLetterCreateSchema = z.object({
  content: z.string().min(1, "Required"),
  jobUrl: z.string().trim().optional().nullable(),
  jobTitle: z.string().trim().optional().nullable(),
  company: z.string().trim().optional().nullable(),
  source: coverLetterSourceSchema,
});

export type CoverLetterSource = z.infer<typeof coverLetterSourceSchema>;
export type CoverLetterCreate = z.infer<typeof coverLetterCreateSchema>;

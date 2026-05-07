import { z } from "zod/v4";

export const resumeMetaSchema = z.object({
  label: z.string().min(1),
});

export type ResumeMetaInput = z.infer<typeof resumeMetaSchema>;

import { z } from "zod/v4";

export const pdfRequestSchema = z.object({
  text: z.string().min(1),
  name: z.string().optional(),
});

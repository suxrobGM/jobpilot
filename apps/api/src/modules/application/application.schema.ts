import { z } from "zod/v4";

export const applicationListQuerySchema = z.object({
  stage: z.string().trim().min(1).optional(),
  board: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

export const applicationQuerySchema = z.object({
  url: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  company: z.string().trim().min(1).optional(),
});

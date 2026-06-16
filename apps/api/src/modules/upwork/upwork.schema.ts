import { z } from "zod/v4";

export const proposalsQuery = z.object({
  status: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

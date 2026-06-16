import { z } from "zod/v4";

/** UUID `id` path param. */
export const idParam = z.object({
  id: z.uuid(),
});

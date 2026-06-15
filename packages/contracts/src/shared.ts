import { z } from "zod/v4";

/** Numeric `id` path param, coerced from the route string and validated positive. */
export const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

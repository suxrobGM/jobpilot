import { z } from "zod/v4";

/**
 * A date stored inside a JSON column: written as an ISO string, parsed back to a `Date`. Unlike
 * `z.coerce.date()` it rejects null and numbers, and its output stays `Date` for Eden.
 */
export const storedDate = z.preprocess(
  (value) => (typeof value === "string" ? new Date(value) : value),
  z.date(),
);

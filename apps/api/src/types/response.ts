import { errorResponseSchema } from "@jobpilot/contracts/errors";
import { z } from "zod/v4";

/**
 * The standard error statuses this API emits, each mapped to the shared error
 * envelope. Applied once via a `.guard({ response })` on the `/api` group so
 * every route documents these in Swagger and Eden Treaty; routes only declare
 * their own 200 success schema.
 */
export const httpErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  422: errorResponseSchema,
  429: errorResponseSchema,
  500: errorResponseSchema,
  502: errorResponseSchema,
} as const;

/** `{ id }` - returned by most create/update routes. */
export const idResponseSchema = z.object({ id: z.uuid() });

/** `{ deleted }` - returned by delete routes that echo the removed id. */
export const deletedResponseSchema = z.object({ deleted: z.uuid() });

/** `{ deletedCount }` - returned by bulk delete routes. */
export const deletedCountResponseSchema = z.object({ deletedCount: z.number().int() });

/** `{ ok: true }` - generic acknowledgement (failures throw the error envelope). */
export const okResponseSchema = z.object({ ok: z.literal(true) });

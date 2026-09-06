import { z } from "zod/v4";

/**
 * Standard error envelope produced by the global error middleware
 * (`{ code, message, details? }`). `code` is a stable string the web client and
 * the agent's skills read. Used as the `response` schema for non-2xx statuses so
 * error shapes show up in Swagger.
 */
export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

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
} as const;

/** `{ id }` - returned by most create/update routes. */
export const idResponseSchema = z.object({ id: z.uuid() });

/** `{ deleted }` - returned by delete routes that echo the removed id. */
export const deletedResponseSchema = z.object({ deleted: z.uuid() });

/** `{ ok: true }` - generic acknowledgement (failures throw the error envelope). */
export const okResponseSchema = z.object({ ok: z.literal(true) });

// Pagination lives in `@jobpilot/contracts/pagination` - the web and the agent's skills need the
// same envelope, and neither can import from `apps/api`.

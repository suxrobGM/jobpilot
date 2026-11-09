import { errorResponseSchema } from "@jobpilot/contracts/errors";
import { z } from "zod/v4";

/** Guarded once on the `/api` group, so routes declare only their 200 schema. */
export const httpErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  422: errorResponseSchema,
  426: errorResponseSchema,
  429: errorResponseSchema,
  500: errorResponseSchema,
  502: errorResponseSchema,
} as const;

export const idResponseSchema = z.object({ id: z.uuid() });

export const deletedResponseSchema = z.object({ deleted: z.uuid() });

export const deletedCountResponseSchema = z.object({ deletedCount: z.number().int() });

export const okResponseSchema = z.object({ ok: z.literal(true) });

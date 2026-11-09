import { z } from "zod/v4";

/** The stable `code` of every error body. Clients branch on it, never on the message text. */
export const ErrorCodes = {
  INVALID_REQUEST: "INVALID_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  UNPROCESSABLE: "UNPROCESSABLE_ENTITY",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  RATE_LIMITED: "RATE_LIMITED",
  KEY_UNRECOVERABLE: "KEY_UNRECOVERABLE",
  BAD_GATEWAY: "BAD_GATEWAY",
  INTERNAL: "INTERNAL_ERROR",
  /** The user already applied to this posting; record the job as skipped instead. */
  ALREADY_APPLIED: "ALREADY_APPLIED",
  /** Another worker is applying to the same posting right now. */
  APPLY_IN_FLIGHT: "APPLY_IN_FLIGHT",
  /** The feed already holds a job with this key. */
  DUPLICATE_JOB: "DUPLICATE_JOB",
  /** A pilot guard refused: stale task list, stopped pilot, task gone, or run already finished. */
  PILOT_CONFLICT: "PILOT_CONFLICT",
  /** The row changed since the caller read it; re-fetch before writing. */
  STALE_WRITE: "STALE_WRITE",
  /** The agent on the user's computer is too old for this API; it must update before calling. */
  AGENT_OUTDATED: "AGENT_OUTDATED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/** The body of every non-2xx response. */
export const errorResponseSchema = z.object({
  code: z.enum(ErrorCodes),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

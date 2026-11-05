import { type ErrorCode, errorResponseSchema } from "@jobpilot/contracts/errors";

/** Raw `{ data, error }` envelope every Eden Treaty client call resolves to. */
export type EdenResult<T> = {
  data: T | null;
  error: { status?: unknown; value?: unknown } | null;
};

/** A failed API call: the server's message plus its stable `code` and HTTP status, so callers
 *  branch on `code` rather than the message text. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: ErrorCode | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const errorMessageSchema = errorResponseSchema.pick({ message: true });

function edenError(error: unknown): NonNullable<EdenResult<unknown>["error"]> {
  return (error ?? {}) as NonNullable<EdenResult<unknown>["error"]>;
}

export function toApiError(error: unknown): ApiError {
  const { status, value } = edenError(error);
  const body = errorResponseSchema.safeParse(value);
  return new ApiError(
    apiErrorMessage(error),
    typeof status === "number" ? status : null,
    body.success ? body.data.code : null,
  );
}

/** Pull a human-readable message out of an Eden Treaty error (`error.value.message`). */
export function apiErrorMessage(error: unknown, fallback?: string): string {
  const { status, value } = edenError(error);
  const body = errorMessageSchema.safeParse(value);
  if (body.success && body.data.message.length > 0) {
    return body.data.message;
  }
  if (fallback) {
    return fallback;
  }
  return typeof status === "number" && status > 0
    ? `Request failed (HTTP ${status})`
    : "Can't reach the server - check your connection";
}

/** Resolve an Eden call to its data, throwing an `ApiError` on any non-2xx - a query function's shape. */
export async function unwrap<T>(request: Promise<EdenResult<T>>): Promise<T> {
  const { data, error } = await request;
  if (error) {
    throw toApiError(error);
  }
  return data as T;
}

/**
 * Unwrap a public detail fetch whose caller maps a null row to `notFound()`. Eden reports every
 * non-2xx as `error`, and a 429 or a blip rendered as "not found" invites Google to deindex a live page.
 * `context` prefixes the message because every caller otherwise logs the same unattributable digest.
 */
export function dataOrThrow<T>(result: EdenResult<T>, context: string): T | null {
  if (result.error && result.error.status !== 404) {
    throw new Error(`${context}: ${apiErrorMessage(result.error)}`);
  }
  return result.data;
}

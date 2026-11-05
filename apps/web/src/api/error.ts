import { type ErrorCode, errorResponseSchema } from "@jobpilot/contracts/errors";

/** Raw `{ data, error }` envelope every Eden Treaty client call resolves to. */
export type EdenResult<T> = {
  data: T | null;
  error: { status?: unknown; value?: unknown } | null;
};

/** Carries the server's stable `code`, so callers branch on it rather than the message text. */
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

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** A 4xx won't change on retry, so only network blips and 5xx are worth a second try. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = error instanceof ApiError ? error.status : null;
  return failureCount < 1 && (status === null || status >= 500);
}

function edenError(error: unknown): NonNullable<EdenResult<unknown>["error"]> {
  return (error ?? {}) as NonNullable<EdenResult<unknown>["error"]>;
}

function toApiError(error: unknown): ApiError {
  const { status, value } = edenError(error);
  const body = errorResponseSchema.safeParse(value);
  return new ApiError(
    apiErrorMessage(error),
    typeof status === "number" ? status : null,
    body.success ? body.data.code : null,
  );
}

function apiErrorMessage(error: unknown, fallback?: string): string {
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

export async function unwrap<T>(request: Promise<EdenResult<T>>): Promise<T> {
  const { data, error } = await request;
  if (error) {
    throw toApiError(error);
  }
  return data as T;
}

/**
 * Only a 404 maps to null: a 429 or a blip rendered as "not found" invites Google to deindex a live
 * page. `context` prefixes the message, or every caller logs the same unattributable digest.
 */
export function dataOrNullIf404<T>(result: EdenResult<T>, context: string): T | null {
  if (result.error && result.error.status !== 404) {
    throw new Error(`${context}: ${apiErrorMessage(result.error)}`);
  }
  return result.data;
}

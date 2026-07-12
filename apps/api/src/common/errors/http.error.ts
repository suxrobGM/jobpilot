/** String error codes - kept stable because the web client and the agent's
 *  curl/jq skills read `error.code`. Do not switch to numeric codes. */
export const ErrorCodes = {
  INVALID_REQUEST: "INVALID_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  UNPROCESSABLE: "UNPROCESSABLE_ENTITY",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL_ERROR",
} as const;

/**
 * An error carrying the HTTP status + envelope code it maps to. Thrown anywhere
 * in a handler or a service it calls; the global `.onError` shapes the response.
 */
export class HttpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
    /** Response headers the global `.onError` copies onto the response (e.g. `retry-after`). */
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function notFound(message = "Not found"): HttpError {
  return new HttpError(ErrorCodes.NOT_FOUND, message, 404);
}

export function conflict(message: string): HttpError {
  return new HttpError(ErrorCodes.CONFLICT, message, 409);
}

export function badRequest(message: string): HttpError {
  return new HttpError(ErrorCodes.INVALID_REQUEST, message, 400);
}

export function unprocessable(message = "Invalid request", details?: unknown): HttpError {
  return new HttpError(ErrorCodes.UNPROCESSABLE, message, 422, details);
}

export function unauthorized(message = "Unauthorized"): HttpError {
  return new HttpError(ErrorCodes.UNAUTHORIZED, message, 401);
}

export function forbidden(message = "Forbidden"): HttpError {
  return new HttpError(ErrorCodes.FORBIDDEN, message, 403);
}

/**
 * 429. `retryAfterSeconds` rides both the `Retry-After` header and `details`: a cross-origin browser
 * can't read the header unless CORS exposes it, but the body always arrives.
 */
export function tooManyRequests(message = "Too many requests", retryAfterSeconds = 60): HttpError {
  return new HttpError(
    ErrorCodes.RATE_LIMITED,
    message,
    429,
    { retryAfterSeconds },
    {
      "retry-after": String(retryAfterSeconds),
    },
  );
}

export function emailNotVerified(): HttpError {
  return new HttpError(
    ErrorCodes.EMAIL_NOT_VERIFIED,
    "Verify your email address to use this feature - check your inbox for the verification link.",
    403,
  );
}

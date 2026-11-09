import { type ErrorCode, ErrorCodes } from "@jobpilot/contracts/errors";

/** Throw it anywhere in a request; the global `.onError` turns it into the error envelope. */
export class HttpError extends Error {
  constructor(
    readonly code: ErrorCode,
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

/** Pass a specific `code` when a client branches on this conflict. */
export function conflict(message: string, code: ErrorCode = ErrorCodes.CONFLICT): HttpError {
  return new HttpError(code, message, 409);
}

export function badRequest(message: string): HttpError {
  return new HttpError(ErrorCodes.INVALID_REQUEST, message, 400);
}

export function unprocessable(message = "Invalid request", details?: unknown): HttpError {
  return new HttpError(ErrorCodes.UNPROCESSABLE, message, 422, details);
}

export function agentOutdated(message: string): HttpError {
  return new HttpError(ErrorCodes.AGENT_OUTDATED, message, 426);
}

export function unauthorized(message = "Unauthorized"): HttpError {
  return new HttpError(ErrorCodes.UNAUTHORIZED, message, 401);
}

export function forbidden(message = "Forbidden"): HttpError {
  return new HttpError(ErrorCodes.FORBIDDEN, message, 403);
}

/** An upstream service (Google, a CAPTCHA solver) failed or answered unusably. */
export function badGateway(message: string): HttpError {
  return new HttpError(ErrorCodes.BAD_GATEWAY, message, 502);
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

import { Elysia } from "elysia";
import { KeyUnrecoverableError } from "@/common/crypto/errors";
import { ErrorCodes, HttpError, prismaCode } from "@/common/errors";
import { logger } from "@/common/logger";
import { env } from "@/env";

interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Global error mapping. Returns the `{ code, message, details? }` body with the
 * right status. `code` is a stable string (web + agent read it).
 */
export const errorMiddleware = new Elysia({ name: "error-middleware" }).onError(
  { as: "global" },
  ({ code, error, set }): ErrorBody => {
    if (error instanceof HttpError) {
      set.status = error.status;
      // Carried on the error, not set at the throw site: rate-limit 429s are thrown from services
      // (CaptchaService's in-flight cap) that never see `set`.
      if (error.headers) {
        for (const [name, value] of Object.entries(error.headers)) {
          set.headers[name] = value;
        }
      }
      return { code: error.code, message: error.message, details: error.details };
    }

    // Dead DEK: a code the web/agent can act on, not a raw AES-GCM 500.
    if (error instanceof KeyUnrecoverableError) {
      set.status = 500;
      logger.warn({ userId: error.userId }, "Encryption key unrecoverable");
      return {
        code: ErrorCodes.KEY_UNRECOVERABLE,
        message: "Your saved secrets can't be decrypted. Re-enter your credentials to continue.",
      };
    }

    if (prismaCode(error) === "P2002") {
      set.status = 409;
      return { code: ErrorCodes.CONFLICT, message: "Already exists" };
    }

    // Update/delete on a row that vanished (concurrent delete) is a 404, not a 500.
    if (prismaCode(error) === "P2025") {
      set.status = 404;
      return { code: ErrorCodes.NOT_FOUND, message: "Not found" };
    }

    if (code === "VALIDATION") {
      set.status = 422;
      return {
        code: ErrorCodes.UNPROCESSABLE,
        message: "Invalid request",
        details: (error as { all?: unknown }).all,
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return { code: ErrorCodes.NOT_FOUND, message: "Not found" };
    }

    if (code === "PARSE") {
      set.status = 400;
      return { code: ErrorCodes.INVALID_REQUEST, message: "Malformed request" };
    }

    set.status = 500;
    logger.error({ err: error }, "Unhandled API error");
    const message =
      env.NODE_ENV === "production"
        ? "Internal error"
        : error instanceof Error
          ? error.message
          : String(error);
    return { code: ErrorCodes.INTERNAL, message };
  },
);

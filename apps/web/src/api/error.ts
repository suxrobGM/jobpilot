/** Raw `{ data, error }` envelope every Eden Treaty client call resolves to. */
export type EdenResult<T> = {
  data: T | null;
  error: { status?: unknown; value?: unknown } | null;
};

/** Pull a human-readable message out of an Eden Treaty error (`error.value.message`). */
export function apiErrorMessage(error: unknown, fallback?: string): string {
  const value = (error as { value?: unknown } | null)?.value;
  const message = (value as { message?: unknown } | null)?.message;
  if (typeof message === "string" && message.length > 0) {
    return message;
  }
  if (fallback) {
    return fallback;
  }
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && status > 0
    ? `Request failed (HTTP ${status})`
    : "Can't reach the server - check your connection";
}

/**
 * Unwrap a public detail fetch whose caller maps a null row to `notFound()`. Eden reports every
 * non-2xx as `error`, and a 429 or a blip rendered as "not found" invites Google to deindex a live page.
 */
export function dataOrThrow<T>(result: EdenResult<T>, fallback: string): T | null {
  if (result.error && result.error.status !== 404) {
    throw new Error(apiErrorMessage(result.error, fallback));
  }
  return result.data;
}

/** Raw `{ data, error }` envelope every Eden Treaty client call resolves to. */
export type EdenResult<T> = {
  data: T | null;
  error: { status?: unknown; value?: unknown } | null;
};

/** Pull a human-readable message out of an Eden Treaty error (`error.value.message`). */
export function apiErrorMessage(error: unknown, fallback = "Request failed"): string {
  const value = (error as { value?: unknown } | null)?.value;
  const message = (value as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

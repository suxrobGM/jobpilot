/**
 * Resolves after `ms` milliseconds.
 *
 * A runtime-agnostic replacement for `bun`'s `sleep` so the same code runs
 * under Bun (dev) and Node (Next.js build workers / production). Used to space
 * out polling loops against external services.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** `Promise.all` over named promises, so a long parallel read can't misalign its results. */
export async function allNamed<T extends Record<string, unknown>>(
  named: T,
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const values = await Promise.all(Object.values(named));
  const keys = Object.keys(named);
  return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as {
    [K in keyof T]: Awaited<T[K]>;
  };
}

/** So a background timer never holds the process open; Bun and Node both have `unref`. */
export function unrefTimer(timer: ReturnType<typeof setTimeout>): void {
  (timer as { unref?: () => void }).unref?.();
}

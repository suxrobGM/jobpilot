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

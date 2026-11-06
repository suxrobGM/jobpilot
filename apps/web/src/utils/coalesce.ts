/** Long enough to fold one server write's burst of events, short enough to feel live. */
const COALESCE_MS = 250;

const pending = new Set<string>();

/** Runs `run` once, `COALESCE_MS` after the first call for `id`; later calls in the window fold in. */
export function coalesce(id: string, run: () => void): void {
  if (pending.has(id)) return;
  pending.add(id);
  setTimeout(() => {
    pending.delete(id);
    run();
  }, COALESCE_MS);
}

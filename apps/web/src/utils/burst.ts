/** Long enough to catch one server write's burst of events, short enough to feel live. */
const BURST_MS = 250;

const pending = new Set<string>();

/** Runs `run` once, `BURST_MS` after the first call for `id`; calls inside that window join it. */
export function runOncePerBurst(id: string, run: () => void): void {
  if (pending.has(id)) return;
  pending.add(id);
  setTimeout(() => {
    pending.delete(id);
    run();
  }, BURST_MS);
}

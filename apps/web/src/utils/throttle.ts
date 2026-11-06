/** Long enough to catch one server write's burst of events, short enough to feel live. */
const WINDOW_MS = 250;

const pending = new Set<string>();

/** Runs `run` at most once per `WINDOW_MS` for `id`, at the window's end. */
export function throttle(id: string, run: () => void): void {
  if (pending.has(id)) return;
  pending.add(id);
  setTimeout(() => {
    pending.delete(id);
    run();
  }, WINDOW_MS);
}

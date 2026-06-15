import { useEffect, useState } from "react";

/**
 * Returns a copy of `value` that updates only after `delayMs` has elapsed
 * without further changes — useful for search inputs or any source that
 * fires faster than downstream work can keep up with.
 *
 * @example
 * ```tsx
 * const [search, setSearch] = useState("");
 * const debouncedSearch = useDebouncedValue(search, 250);
 * useEffect(() => {
 *   query(debouncedSearch);
 * }, [debouncedSearch]);
 * ```
 *
 * @param value    The current (eager) value.
 * @param delayMs  Quiet period before the debounced value catches up.
 * @returns The most recent value that stayed stable for at least `delayMs`.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

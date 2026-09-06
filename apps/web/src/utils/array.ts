/** Keeps the first occurrence of each `id`, preserving order. */
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

/**
 * Returns a new array with the element at `idx` swapped with its neighbor
 * in `direction` (-1 for previous, 1 for next). If the swap would land out
 * of bounds, the original array is returned unchanged.
 */
export function moveAt<T>(arr: T[], idx: number, direction: -1 | 1): T[] {
  const target = idx + direction;
  if (target < 0 || target >= arr.length) return arr;
  const next = [...arr];
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}

/**
 * Returns a new array with the element at `idx` removed.
 * Out-of-range indices produce a shallow copy of the original array.
 */
export function removeAt<T>(arr: T[], idx: number): T[] {
  return arr.filter((_, i) => i !== idx);
}

/**
 * Returns a new array with the element at `idx` replaced by `value`.
 * Out-of-range indices behave like sparse-array assignment (extends `arr.length`).
 */
export function replaceAt<T>(arr: T[], idx: number, value: T): T[] {
  const next = [...arr];
  next[idx] = value;
  return next;
}

/**
 * Stable keys for a fixed-length placeholder list. Skeleton rows have no model
 * to key by, and Biome's `noArrayIndexKey` rules out the index itself.
 */
export function slotKeys(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `slot-${index}`);
}

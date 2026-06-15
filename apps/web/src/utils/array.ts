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

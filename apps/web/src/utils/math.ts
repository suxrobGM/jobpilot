/**
 * Clamps `value` to the inclusive range [`min`, `max`].
 * Returns `min` if the value falls below the range, `max` if above, otherwise `value`.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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

export function moveAt<T>(arr: T[], idx: number, direction: -1 | 1): T[] {
  const target = idx + direction;
  if (target < 0 || target >= arr.length) {
    return arr;
  }
  const next = [...arr];
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}

export function removeAt<T>(arr: T[], idx: number): T[] {
  return arr.filter((_, i) => i !== idx);
}

export function replaceAt<T>(arr: T[], idx: number, value: T): T[] {
  const next = [...arr];
  next[idx] = value;
  return next;
}

/** Skeleton rows have no model to key by, and Biome's `noArrayIndexKey` rules out the index. */
export function slotKeys(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `slot-${index}`);
}

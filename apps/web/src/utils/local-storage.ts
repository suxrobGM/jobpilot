/**
 * Reads a JSON-serialized value from `window.localStorage` under `key`.
 * Returns `null` on SSR, when the key is missing, or when the stored value
 * cannot be parsed as JSON. The result is cast to `T` without runtime
 * validation — callers that need to defend against stale or hand-edited
 * entries should validate the shape before using it.
 */
export function readLocalStorage<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Writes `value` to `window.localStorage` under `key` as a JSON string.
 * No-ops on SSR.
 */
export function writeLocalStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

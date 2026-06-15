interface SlugifyOptions {
  /** Truncate to at most this many characters before applying the fallback. */
  maxLength?: number;
  /** Returned when the input slugifies to an empty string. */
  fallback?: string;
}

/**
 * Lowercase, replace non-alphanumeric runs with `-`, trim leading/trailing `-`,
 * truncate, and fall back to a placeholder when the result is empty.
 */
export function slugify(input: string, options: SlugifyOptions = {}): string {
  const { maxLength = 60, fallback = "" } = options;
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  return slug || fallback;
}

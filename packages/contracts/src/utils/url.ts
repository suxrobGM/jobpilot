/**
 * Normalizes a user-entered or extracted link by trimming whitespace and
 * prefixing `https://` when no protocol is present. Returns "" for blank
 * input so optional URL fields stay representable as empty strings.
 */
export function normalizeLinkUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

type UrlParamValue = string | number | boolean | Date | null | undefined;

type UrlParams = Record<string, UrlParamValue>;

function stringifyParam(value: Exclude<UrlParamValue, null | undefined>): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Builds a query string from present parameter values.
 *
 * Null, undefined, and empty-string values are omitted so callers can pass
 * filter objects directly without repeating conditional `URLSearchParams.set`
 * calls.
 */
export function buildQueryString(params: UrlParams = {}): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    searchParams.set(key, stringifyParam(value));
  }

  return searchParams.toString();
}

/**
 * Appends present query parameters to a path or URL.
 */
export function buildUrl(path: string, params: UrlParams = {}): string {
  const queryString = buildQueryString(params);
  if (!queryString) {
    return path;
  }
  return `${path}${path.includes("?") ? "&" : "?"}${queryString}`;
}

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

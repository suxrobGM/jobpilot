import { parseCanonicalUrl } from "@/common/utils";

/** Boards serving one posting under a second hostname; the value is the form we store. */
const HOST_ALIASES: Record<string, string> = {
  "hiring.cafe": "hiringcafe.com",
};

/** Params that say where the click came from, never which posting it points at. */
const TRACKING_PARAMS = new Set([
  "gclid",
  "fbclid",
  "msclkid",
  "gh_src",
  "trk",
  "trackingid",
  "refid",
]);

function isTracking(name: string): boolean {
  return name.startsWith("utm_") || TRACKING_PARAMS.has(name);
}

/**
 * https, aliases folded, no trailing slash; unparseable or non-http(s) input is returned untouched.
 * Strips less than the listing index's `canonicalizeUrl` on purpose: this form keys
 * `@@unique([userId, url])`, so widening it retires the match against every row already stored.
 */
export function canonicalizeJobUrl(url: string): string {
  const parsed = parseCanonicalUrl(url, isTracking);
  if (!parsed) {
    return url;
  }

  parsed.protocol = "https:";
  parsed.hostname = HOST_ALIASES[parsed.hostname] ?? parsed.hostname;

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed.toString();
}

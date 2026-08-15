/**
 * Hostnames that are known to be aliases of each other, so that a job posting on one can be recognized as the same posting on the other.
 * The canonical form is the value, which is what the duplicate guard uses to compare postings.
 */
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
  const key = name.toLowerCase();
  return key.startsWith("utm_") || TRACKING_PARAMS.has(key);
}

/**
 * https, no `www.`, lower-case host, aliases folded, no fragment, no tracking params, params
 * sorted, no trailing slash. Anything unparseable or not http(s) is returned untouched.
 */
export function canonicalizeJobUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return url;
  }

  const bareHost = parsed.hostname.replace(/^www\./, "");
  parsed.protocol = "https:";
  parsed.hostname = HOST_ALIASES[bareHost] ?? bareHost;
  parsed.hash = "";

  for (const name of [...parsed.searchParams.keys()]) {
    if (isTracking(name)) {
      parsed.searchParams.delete(name);
    }
  }
  parsed.searchParams.sort();

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed.toString();
}

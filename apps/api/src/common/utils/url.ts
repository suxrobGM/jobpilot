/** Boards serving one posting under a second hostname; the value is the form we store. */
const HOST_ALIASES: Record<string, string> = {
  "hiring.cafe": "hiringcafe.com",
};

/**
 * Params that say where the click came from, never which posting it points at. Only `gh_src` of
 * Greenhouse's params: `gh_jid` is the posting id, so a `gh_` prefix would merge distinct jobs.
 */
const TRACKING_PARAMS = new Set([
  "feed",
  "fbclid",
  "gclid",
  "gh_src",
  "msclkid",
  "origin",
  "ref",
  "referer",
  "referrer",
  "refid",
  "source",
  "src",
  "trackingid",
  "trk",
]);

/** Lowercase, without `www.`, aliases folded: the one host form job URLs and board domains share. */
export function canonicalHost(host: string): string {
  const bare = host.toLowerCase().replace(/^www\./, "");
  return HOST_ALIASES[bare] ?? bare;
}

function isTracking(name: string): boolean {
  return name.startsWith("utm_") || TRACKING_PARAMS.has(name);
}

/**
 * The one stored form of a posting URL, so every table joins and dedupes on the same string:
 * https, lowercase host without `www.`, host aliases folded, tracking params and fragment dropped,
 * params sorted, no trailing slash (a bare root keeps its `/`). Unparseable or non-http(s) input
 * comes back trimmed.
 */
export function normalizeJobUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return raw.trim();
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return raw.trim();
  }

  url.protocol = "https:";
  url.hash = "";
  url.hostname = canonicalHost(url.hostname);
  for (const name of [...url.searchParams.keys()]) {
    if (isTracking(name.toLowerCase())) {
      url.searchParams.delete(name);
    }
  }
  url.searchParams.sort();
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

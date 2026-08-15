/**
 * Canonical form of a job posting URL, so `@@unique([userId, url])` sees one posting as one row.
 *
 * hiring.cafe began serving the same postings from hiringcafe.com mid-2026 with byte-identical
 * paths - the same job id slug under a second host. Two real applications went out to GitLab and
 * Alpaca because the exact-url check saw two different URLs for one posting.
 */
const HOST_ALIASES: Record<string, string> = {
  "hiring.cafe": "hiringcafe.com",
  "www.hiringcafe.com": "hiringcafe.com",
};

/** Rewrites known alias hosts; anything unparseable is returned untouched. */
export function canonicalizeJobUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const canonical = HOST_ALIASES[parsed.host.toLowerCase()];
  if (!canonical) {
    return url;
  }

  parsed.host = canonical;
  return parsed.toString();
}

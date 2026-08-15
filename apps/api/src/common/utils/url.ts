/**
 * Strips what varies between two links to one page: fragment, host case, `www.`, tracking params,
 * param order. Null for anything unparseable or not http(s). Scheme and trailing slash are left to
 * the caller - the tables we store URLs in disagree on both.
 */
export function parseCanonicalUrl(raw: string, isTracking: (name: string) => boolean): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  for (const name of [...url.searchParams.keys()]) {
    if (isTracking(name.toLowerCase())) {
      url.searchParams.delete(name);
    }
  }
  url.searchParams.sort();
  return url;
}

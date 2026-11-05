export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

/** Canonical production origin - the single source for metadata, sitemap, robots, and JSON-LD. */
export const SITE_URL = "https://jobpilot.suxrobgm.net";

/** The bare host, for display (card footers, copy snippets). */
export const SITE_HOST = new URL(SITE_URL).host;

/** GitHub repository, surfaced as the org's `sameAs` and in the footer. */
export const GITHUB_URL = "https://github.com/suxrobGM/jobpilot";

/** An absolute off-site URL; the theme's link component opens these in a new tab. */
export type ExternalUrl = `https://${string}`;

export const BUG_REPORT_URL = `${GITHUB_URL}/issues/new?template=bug_report.yml` as const;
export const FEATURE_REQUEST_URL = `${GITHUB_URL}/issues/new?template=feature_request.yml` as const;

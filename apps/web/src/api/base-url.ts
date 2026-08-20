/** Elysia backend origin for browser-facing URLs (EventSource, PDF hrefs). NEXT_PUBLIC_ so it's inlined client-side. */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4101";

/** Origin for Eden calls. Server renders reach the API container directly; the browser must not. */
export const API_ORIGIN =
  typeof window === "undefined" ? (process.env.INTERNAL_API_URL ?? API_BASE_URL) : API_BASE_URL;

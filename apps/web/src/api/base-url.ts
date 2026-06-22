/** Elysia backend origin for all web→API calls (Eden, EventSource, PDF hrefs). NEXT_PUBLIC_ so it's inlined client-side. */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

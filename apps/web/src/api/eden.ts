import { createApiClient } from "@jobpilot/api-client";

/**
 * Browser Eden Treaty client, typed end-to-end from the backend `App`.
 *
 * The base URL is the current origin so the httpOnly auth cookie stays
 * first-party; the `next.config.ts` `/api/*` rewrite forwards same-origin
 * requests to the Elysia backend. On the server (where this module may be
 * imported for its `typeof api` types) we fall back to the backend URL, but the
 * runtime client is only ever *called* from client components — RSC/route
 * handlers use `serverApi()` from `./server-api` so the per-request cookie is
 * forwarded.
 */
const baseUrl =
  typeof window === "undefined"
    ? (process.env.API_PROXY_TARGET ?? "http://localhost:8002")
    : window.location.origin;

export const api = createApiClient(baseUrl, { fetch: { credentials: "include" } }).api;

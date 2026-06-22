import { createApiClient } from "@jobpilot/api-client";

/**
 * Browser Eden Treaty client, typed end-to-end from the backend `App`.
 *
 * The base URL is the current origin so the httpOnly auth cookie stays
 * first-party; the `next.config.ts` `/api/*` rewrite forwards same-origin
 * requests to the Elysia backend.
 */
const baseUrl =
  typeof window === "undefined"
    ? (process.env.API_URL ?? "http://localhost:8002")
    : window.location.origin;

/**
 * Base API client instance for making requests to the Elysia backend.
 * This can be used in server components by passing server-side fetch options with the cookie header for authentication,
 * or in client components where the cookie is automatically included in same-origin requests.
 */
export const api = createApiClient(baseUrl, { fetch: { credentials: "include" } }).api;

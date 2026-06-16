import "server-only";
import { createApiClient } from "@jobpilot/api-client";
import { cookies } from "next/headers";

const API_BASE = process.env.API_URL ?? "http://localhost:8002";

/**
 * Per-request Eden Treaty client for RSC pages and route handlers. Forwards the
 * incoming browser auth cookie to the backend and disables caching so one
 * request's data never leaks into another. Never cache this as a singleton —
 * `cookies()` is per-request.
 */
export async function serverApi() {
  const cookie = (await cookies()).toString();
  return createApiClient(API_BASE, {
    headers: cookie ? { cookie } : {},
    fetch: { cache: "no-store" },
  }).api;
}

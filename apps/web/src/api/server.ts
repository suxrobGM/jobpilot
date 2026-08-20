import "server-only";
import { cookies, headers } from "next/headers";

// Pages either render data fully in RSC (no React Query, e.g. admin pages, cover-letters/[id])
// or fetch client-side via `@/api/queries` defs - never seed React Query's `initialData` from here.

export interface ServerFetchOptions {
  fetch: { headers: Record<string, string> };
}

/**
 * The API buckets public rate limits by this header, and the SSR call carries none of its own -
 * it reaches the API container directly, so nginx never stamps one on the way in. Every public
 * server render must pass this, or the whole user base shares one bucket. Not for a `"use cache"`
 * scope or a build-time render: `headers()` is a hard error there, and they have no visitor anyway.
 */
async function clientIpHeader(): Promise<Record<string, string>> {
  const ip = (await headers()).get("x-real-ip")?.trim();
  return ip ? { "x-real-ip": ip } : {};
}

export async function getPublicFetchOptions(): Promise<ServerFetchOptions> {
  return { fetch: { headers: await clientIpHeader() } };
}

export async function getFetchOptions(): Promise<ServerFetchOptions> {
  const cookie = (await cookies()).toString();
  return { fetch: { headers: { cookie, ...(await clientIpHeader()) } } };
}

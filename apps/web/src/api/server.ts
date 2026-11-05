import "server-only";
import { cookies, headers } from "next/headers";
import { clientIpHeader } from "./client-ip";

export interface ServerFetchOptions {
  fetch: { headers: Record<string, string> };
}

/** Not for `"use cache"` or a build-time render: `headers()` is a hard error there. */
export async function getPublicFetchOptions(): Promise<ServerFetchOptions> {
  return { fetch: { headers: clientIpHeader(await headers()) } };
}

export async function getFetchOptions(): Promise<ServerFetchOptions> {
  const cookie = (await cookies()).toString();
  return { fetch: { headers: { cookie, ...clientIpHeader(await headers()) } } };
}

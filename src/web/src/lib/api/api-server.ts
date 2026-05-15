import "server-only";
import { headers } from "next/headers";

interface ApiOk<T> {
  data: T;
  status: number;
}

interface ApiNotFound {
  data: null;
  status: 404;
}

/**
 * Resolve an absolute URL to a same-origin API route from inside an RSC.
 * Uses Next's request headers so it works in dev, prod, and behind proxies.
 */
async function resolveApiUrl(path: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_APP_URL;
  if (!origin) {
    throw new Error("Could not determine origin for server-side API fetch");
  }
  return `${origin}${path}`;
}

/**
 * Server-side GET against the app's own API. Returns `{ data: null, status: 404 }`
 * when the API responds with 404 — callers should map that to `notFound()`.
 * Any other non-ok status throws.
 */
export async function apiGet<T>(path: string): Promise<ApiOk<T> | ApiNotFound> {
  const url = await resolveApiUrl(path);
  const res = await fetch(url, { cache: "no-store" });

  if (res.status === 404) {
    return { data: null, status: 404 };
  }
  if (!res.ok) {
    throw new Error(`API ${path} failed with status ${res.status}`);
  }

  const body = (await res.json()) as { data: T };
  return { data: body.data, status: res.status };
}

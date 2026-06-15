import { cookies } from "next/headers";

const API_BASE = process.env.API_PROXY_TARGET ?? "http://localhost:8002";

/**
 * Server-side GET (RSC / route handlers) that forwards the browser's auth cookie
 * to the backend and returns the bare payload (the backend no longer wraps in
 * `{ ok, data }`). Returns `{ data: null }` on any non-2xx (incl. 401).
 */
export async function serverGet<T>(path: string): Promise<{ data: T | null; status: number }> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    cache: "no-store",
  });
  if (!res.ok) {
    return { data: null, status: res.status };
  }
  const text = await res.text();
  return { data: text ? (JSON.parse(text) as T) : null, status: res.status };
}

import "server-only";
import { cookies } from "next/headers";

export interface ServerFetchOptions {
  fetch: { headers: { cookie: string } };
}

/**
 * Helper to get the cookie string on the server render.
 */
export async function getServerCookie(): Promise<string> {
  return (await cookies()).toString();
}

/**
 * Get server-side fetch options with the cookie header set for authentication.
 * @returns
 */
export async function getFetchOptions(): Promise<ServerFetchOptions> {
  const cookieHeader = await getServerCookie();
  return { fetch: { headers: { cookie: cookieHeader } } };
}

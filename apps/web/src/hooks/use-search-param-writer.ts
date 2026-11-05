"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * `shallow` (replaceState) for client state: a `router.replace()` that only drops a param doesn't
 * always commit under `cacheComponents`. `navigate` for params an RSC page reads server-side.
 */
export type SearchParamMode = "shallow" | "navigate";

/** `null` or `""` drops the param. */
function buildHref(
  pathname: string,
  current: URLSearchParams,
  updates: Record<string, string | null>,
): string {
  const params = new URLSearchParams(current.toString());
  for (const [key, next] of Object.entries(updates)) {
    if (next) {
      params.set(key, next);
    } else {
      params.delete(key);
    }
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** One call per handler: two would start from the same URL snapshot, so the second undoes the first. */
export function useSearchParamWriter(
  mode: SearchParamMode = "shallow",
): (updates: Record<string, string | null>) => void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (updates) => {
    const href = buildHref(pathname, searchParams, updates);
    if (mode === "navigate") {
      router.replace(href as Parameters<typeof router.replace>[0], { scroll: false });
      return;
    }
    window.history.replaceState(null, "", href);
  };
}

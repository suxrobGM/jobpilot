import type { Route } from "next";

/** Drops `page` unless given: a filter change keeping it can strand you past the last page. */
export function jobsHref(params: URLSearchParams, page?: number): Route {
  if (page && page > 1) {
    params.set("page", String(page));
  } else {
    params.delete("page");
  }
  const query = params.toString();
  return (query ? `/jobs?${query}` : "/jobs") as Route;
}

/** The current filters with `updates` applied; a null or empty value drops its key. */
export function jobsHrefWith(
  params: URLSearchParams,
  updates: Record<string, string | null>,
): Route {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
  }
  return jobsHref(next);
}

import type { Route } from "next";

export function campaignHref(campaignId: string): Route {
  return `/campaigns/${encodeURIComponent(campaignId)}` as Route;
}

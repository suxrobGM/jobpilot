import { parseTechParam } from "@jobpilot/contracts/job-listing";
import { cacheLife } from "next/cache";
import { api } from "@/api/client";

/** The same for every visitor, so cached instead of fetched per request. */
export async function getSkillFacets(): Promise<string[]> {
  "use cache";
  cacheLife("hours");

  const { data } = await api.public.jobs.facets.get();
  return data?.skills.map((facet) => facet.value) ?? [];
}

/** The skill takes the facet's casing so `?tech=react` and `?tech=React` aren't duplicates. */
export function landingParams(filters: Record<string, string>, skills: string[]): URLSearchParams {
  const landing = new URLSearchParams();
  const tech = parseTechParam(filters.tech);
  const skill = tech.length === 1 && skills.find((s) => s.toLowerCase() === tech[0].toLowerCase());
  if (skill) {
    landing.set("tech", skill);
  }
  if (filters.remote === "true") {
    landing.set("remote", "true");
  }
  return landing;
}

export function landingTitle(landing: URLSearchParams): string {
  const tech = landing.get("tech");
  if (landing.has("remote")) {
    return tech ? `Remote ${tech} jobs` : "Remote jobs";
  }
  return tech ? `${tech} jobs` : "Jobs";
}

/** The landing views worth a sitemap entry: remote-only, and each skill on its own. */
export function sitemapLandingViews(skills: string[]): URLSearchParams[] {
  const views = [{ remote: "true" }, ...skills.map((tech) => ({ tech }))];
  return views.map((view) => landingParams(view, skills));
}

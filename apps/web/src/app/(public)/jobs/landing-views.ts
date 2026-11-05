import { parseSkillsParam } from "@jobpilot/contracts/job-listing";
import { cacheLife } from "next/cache";
import { api } from "@/api/client";

/** The same for every visitor, so cached instead of fetched per request. */
export async function getSkillFacets(): Promise<string[]> {
  "use cache";
  cacheLife("hours");

  const { data } = await api.public.jobs.facets.get();
  return data?.skills.map((facet) => facet.value) ?? [];
}

/** The skill takes the facet's casing so `?skills=react` and `?skills=React` aren't duplicates. */
export function landingParams(filters: Record<string, string>, skills: string[]): URLSearchParams {
  const landing = new URLSearchParams();
  const wanted = parseSkillsParam(filters.skills);
  const skill =
    wanted.length === 1 && skills.find((s) => s.toLowerCase() === wanted[0].toLowerCase());
  if (skill) {
    landing.set("skills", skill);
  }
  if (filters.remote === "true") {
    landing.set("remote", "true");
  }
  return landing;
}

export function landingTitle(landing: URLSearchParams): string {
  const skill = landing.get("skills");
  if (landing.has("remote")) {
    return skill ? `Remote ${skill} jobs` : "Remote jobs";
  }
  return skill ? `${skill} jobs` : "Jobs";
}

/** The landing views worth a sitemap entry: remote-only, and each skill on its own. */
export function sitemapLandingViews(skills: string[]): URLSearchParams[] {
  const views = [{ remote: "true" }, ...skills.map((skill) => ({ skills: skill }))];
  return views.map((view) => landingParams(view, skills));
}

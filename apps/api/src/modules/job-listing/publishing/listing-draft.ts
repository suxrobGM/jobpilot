import { z } from "zod/v4";
import { normalizeJobUrl } from "@/common/utils/url";
import { MAX_YEARS_EXPERIENCE } from "@/modules/scoring/scoring.schema";
import { listingSlug, matchKey, normalizeListingLocation } from "./listing-identity";

const MAX_EXCERPT = 600;

/** Bullets are scraped text landing in a public payload, so both dimensions are capped. */
const MAX_BULLETS = 12;
const MAX_BULLET_LENGTH = 300;

/**
 * Looser than scoring's `jobBriefSchema`, which strips the posting-shaped keys
 * (location/salary/remote) this index wants. `Job.brief` is stored as sent, so they are usually present.
 */
const briefSchema = z.object({
  skills: z.array(z.string()).optional(),
  descriptionExcerpt: z.string().optional(),
  location: z.string().optional(),
  salary: z.string().optional(),
  employmentType: z.string().optional(),
  remote: z.boolean().optional(),
  requirements: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  yearsExperience: z.number().optional(),
});

/** The subset of a `Job` a listing may read. Anything user-identifying is absent by design. */
export interface ListingSourceJob {
  title: string;
  company: string;
  url: string;
  status?: string;
  location?: string | null;
  salary?: string | null;
  employmentType?: string | null;
  boardId?: string | null;
  description?: string | null;
  brief?: unknown;
}

export interface ListingDraft {
  matchKey: string;
  slug: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  salary: string | null;
  employmentType: string | null;
  skills: string[];
  descriptionExcerpt: string | null;
  requirements: string[];
  responsibilities: string[];
  yearsExperience: number | null;
  boardId: string | null;
  url: string;
}

function parseBrief(stored: unknown): z.infer<typeof briefSchema> {
  // A malformed brief is a thin job, not an error - the next PATCH usually fixes it.
  const parsed = briefSchema.safeParse(stored);
  return parsed.success ? parsed.data : {};
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
}

function excerpt(value: string | null): string | null {
  return value ? truncate(value, MAX_EXCERPT) : null;
}

function bullets(values: string[] | undefined): string[] {
  return (values ?? [])
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, MAX_BULLETS)
    .map((v) => truncate(v, MAX_BULLET_LENGTH));
}

function yearsExperience(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value)) {
    return null;
  }
  const years = Math.trunc(value);
  return years > 0 && years <= MAX_YEARS_EXPERIENCE ? years : null;
}

/**
 * Build the draft, or null when the job is too thin to publish - the one gate every publish path
 * routes through, so callers never pre-filter. A stub the agent never opened has no brief; the
 * PATCH that adds one re-runs this.
 */
export function buildListingDraft(job: ListingSourceJob): ListingDraft | null {
  // A queued row is a bare pasted URL with a placeholder title; nothing to index until it's visited.
  if (job.status === "queued") {
    return null;
  }
  const title = clean(job.title);
  const company = clean(job.company);
  const url = clean(job.url);
  if (!title || !company || !url) {
    return null;
  }

  const brief = parseBrief(job.brief);
  // A posting with no named skills has nothing to filter or match on, so it never gets published.
  const skills = (brief.skills ?? []).map((skill) => skill.trim()).filter(Boolean);
  if (skills.length === 0) {
    return null;
  }

  const location = clean(job.location) ?? clean(brief.location);
  const key = matchKey({ title, company, location });

  return {
    matchKey: key,
    slug: listingSlug({ title, company, location }, key),
    title,
    company,
    location,
    remote: brief.remote === true || normalizeListingLocation(location) === "remote",
    salary: clean(job.salary) ?? clean(brief.salary),
    employmentType: clean(job.employmentType) ?? clean(brief.employmentType),
    skills,
    descriptionExcerpt: excerpt(clean(brief.descriptionExcerpt) ?? clean(job.description)),
    requirements: bullets(brief.requirements),
    responsibilities: bullets(brief.responsibilities),
    yearsExperience: yearsExperience(brief.yearsExperience),
    boardId: job.boardId ?? null,
    url: normalizeJobUrl(url),
  };
}

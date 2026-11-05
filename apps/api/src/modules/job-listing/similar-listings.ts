import { type JobListing, Prisma, type PrismaClient } from "@/generated/prisma/client";
import { resolveSkillFilter } from "./skill-vocabulary";

const SIMILAR_LIMIT = 6;
/** A shared skill outweighs a shared title word, remote flag, or region. */
const SKILL_WEIGHT = 3;

/** Word boundary for titles. The ranking query splits candidate titles with this same pattern. */
const TITLE_SPLIT = "[^a-z0-9+#]+";

// Remote and location score on their own, so their words don't count twice.
const FILLER_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "remote",
  "hybrid",
  "onsite",
  "site",
  "contract",
  "full",
  "part",
  "time",
]);

type SimilarSource = Pick<JobListing, "id" | "skills" | "title" | "remote" | "location">;

export function titleWords(title: string): string[] {
  const words = title
    .toLowerCase()
    .split(new RegExp(TITLE_SPLIT))
    .filter((word) => word !== "" && !FILLER_WORDS.has(word));
  return [...new Set(words)];
}

/** "Nashville, TN (Remote)" -> "tn", "United States" -> "united states". */
function region(location: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`lower(trim(regexp_replace(regexp_replace(${location}, '^.*,', ''), '[(].*[)]', '', 'g')))`;
}

/**
 * Ids of published listings sharing a skill with `listing`, best first: shared skills, then shared
 * title words, matching remote, and matching region; ties newest first.
 */
export async function rankSimilarIds(
  prisma: Pick<PrismaClient, "$queryRaw">,
  listing: SimilarSource,
  variants: Map<string, string[]>,
): Promise<string[]> {
  // `&&` gets every stored casing so the GIN index serves it; the scores compare lowercased.
  const ranked = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM job_listings
    WHERE status = 'published'::job_listing_status
      AND id <> ${listing.id}::uuid
      AND skills && ${resolveSkillFilter(listing.skills, variants)}::text[]
    ORDER BY
      ${SKILL_WEIGHT} * cardinality(ARRAY(
        SELECT lower(skill) FROM unnest(skills) AS skill
        INTERSECT
        SELECT lower(skill) FROM unnest(${listing.skills}::text[]) AS skill
      ))
      + cardinality(ARRAY(
        SELECT word FROM regexp_split_to_table(lower(title), ${TITLE_SPLIT}) AS word
        INTERSECT
        SELECT unnest(${titleWords(listing.title)}::text[])
      ))
      + (remote = ${listing.remote})::int
      + coalesce((${region(Prisma.sql`location`)} = ${region(Prisma.sql`${listing.location}::text`)})::int, 0)
      DESC,
      first_seen_at DESC
    LIMIT ${SIMILAR_LIMIT}
  `;
  return ranked.map((row) => row.id);
}

interface IdentifiedRow {
  id: string;
}

/** Restores ranked order after an `id IN (...)` fetch, dropping ids whose row has gone. */
export function inRankedOrder<T extends IdentifiedRow>(rows: T[], ids: string[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

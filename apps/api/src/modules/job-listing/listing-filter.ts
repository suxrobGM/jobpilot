import {
  type AdminJobListingQuery,
  JOB_LISTING_POSTED_WITHIN,
  type JobListingSort,
} from "@jobpilot/contracts/job-listing";
import { DAY_MS } from "@/common/date/buckets";
import type { Prisma } from "@/generated/prisma/client";
import { boardFilter } from "@/modules/job-board/board-host";
import { resolveSkillFilter } from "./skill-vocabulary";

/** `variants` maps a lowercased skill to its stored casings; `hasSome` itself is case-sensitive. */
export function listingWhere(
  query: AdminJobListingQuery,
  variants: Map<string, string[]>,
  now: Date,
): Prisma.JobListingWhereInput {
  const { q, location, remote, board, skills: wanted, posted, status } = query;
  const skills = wanted?.length ? resolveSkillFilter(wanted, variants) : [];

  return {
    ...(status && { status }),
    ...(remote !== undefined && { remote }),
    ...(location && { location: { contains: location, mode: "insensitive" } }),
    ...(skills.length > 0 && { skills: { hasSome: skills } }),
    ...(board && { sources: { some: { board: boardFilter(board) } } }),
    ...(posted && {
      firstSeenAt: { gte: new Date(now.getTime() - JOB_LISTING_POSTED_WITHIN[posted] * DAY_MS) },
    }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
      ],
    }),
  };
}

export function listingOrder(
  sort: JobListingSort | undefined,
): Prisma.JobListingOrderByWithRelationInput {
  return sort === "newest" ? { firstSeenAt: "desc" } : { lastSeenAt: "desc" };
}

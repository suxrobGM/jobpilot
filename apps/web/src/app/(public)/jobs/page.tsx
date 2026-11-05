import { type ReactElement, Suspense } from "react";
import { JOB_LISTING_FILTER_KEYS, JOB_LISTING_MAX_PAGE } from "@jobpilot/contracts/job-listing";
import { Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { api } from "@/api/client";
import { getPublicFetchOptions } from "@/api/server";
import {
  JobFilters,
  JobList,
  JobPager,
  JobSortControls,
  jobsHref,
} from "@/components/features/jobs";
import { JsonLd } from "@/components/seo/json-ld";
import { LinkButton } from "@/components/ui/buttons";
import { DetailSkeleton, EmptyState, TableSkeleton } from "@/components/ui/feedback";
import { breadcrumbLd } from "@/lib/seo/structured-data";
import { formatCount } from "@/utils/format";
import { one, pageParam } from "@/utils/search-params";
import { getSkillFacets, landingParams, landingTitle } from "./landing-views";

type SearchParams = Record<string, string | string[] | undefined>;

interface JobsPageProps {
  searchParams: Promise<SearchParams>;
}

function readFilters(params: SearchParams): Record<string, string> {
  const filters: Record<string, string> = {};
  for (const key of JOB_LISTING_FILTER_KEYS) {
    const value = one(params[key]);
    if (value) {
      filters[key] = value;
    }
  }
  return filters;
}

interface JobsView {
  filters: Record<string, string>;
  /** The indexable view this one belongs to; itself when `isLanding`. */
  landing: URLSearchParams;
  isLanding: boolean;
  page: number;
}

async function readView(params: SearchParams): Promise<JobsView> {
  const filters = readFilters(params);
  const landing = landingParams(filters, await getSkillFacets());
  return {
    filters,
    landing,
    isLanding: Object.keys(filters).every((key) => landing.has(key)),
    page: pageParam(params.page, JOB_LISTING_MAX_PAGE),
  };
}

/**
 * A landing view's pages canonicalize to themselves so every listing stays reachable. Any other
 * filter (search text, several skills) canonicalizes to its landing view's first page.
 */
export async function generateMetadata(props: JobsPageProps): Promise<Metadata> {
  const { landing, isLanding, page } = await readView(await props.searchParams);
  const title = landingTitle(landing);
  return {
    title: isLanding && page > 1 ? `${title} · Page ${page}` : title,
    description: `${title} found by JobPilot agents on LinkedIn, Indeed, Wellfound, Y Combinator, and other boards, with each job listed once.`,
    alternates: { canonical: jobsHref(landing, isLanding ? page : undefined) },
  };
}

export default function JobsPage(props: JobsPageProps): ReactElement {
  return (
    <Stack spacing={4}>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Jobs", path: "/jobs" },
        ])}
      />
      <Stack spacing={1}>
        <Typography variant="displayMd" component="h1">
          Jobs found by JobPilot
        </Typography>
        <Typography variant="body1Muted">
          Real job postings that JobPilot users' agents found on many boards, with each job listed
          once. Your own agent can apply to any of them.
        </Typography>
      </Stack>

      <Suspense fallback={<DetailSkeleton heights={[98]} />}>
        <JobFiltersPanel />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <JobsResults searchParams={props.searchParams} />
      </Suspense>
    </Stack>
  );
}

async function JobFiltersPanel(): Promise<ReactElement> {
  return <JobFilters skillOptions={await getSkillFacets()} />;
}

async function JobsResults(props: JobsPageProps): Promise<ReactElement> {
  const { filters, landing, isLanding, page } = await readView(await props.searchParams);

  const { data, error } = await api.public.jobs.get({
    query: { ...filters, page, limit: 24 },
    ...(await getPublicFetchOptions()),
  });

  if (error || !data) {
    return (
      <EmptyState
        title="Jobs are unavailable right now"
        description="We couldn't reach the job index. Try again in a moment."
      />
    );
  }

  if (data.items.length === 0) {
    return (
      <EmptyState
        title="No jobs match those filters"
        description="Try a broader search, or clear the filters to see everything the agents have found."
        action={
          <LinkButton href="/jobs" variant="outlined">
            Clear filters
          </LinkButton>
        }
      />
    );
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          gap: 1.5,
          justifyContent: "space-between",
          alignItems: { xs: "stretch", sm: "center" },
        }}
      >
        <Typography variant="body2Strong" component="h2">
          {formatCount(data.pagination.total)}{" "}
          {resultsNoun(landing, isLanding, data.pagination.total)}
        </Typography>
        <JobSortControls />
      </Stack>
      <JobList jobs={data.items} />
      <JobPager pagination={data.pagination} params={filters} />
    </Stack>
  );
}

function resultsNoun(landing: URLSearchParams, isLanding: boolean, total: number): string {
  if (isLanding && landing.size > 0) {
    return landingTitle(landing);
  }
  return total === 1 ? "job" : "jobs";
}

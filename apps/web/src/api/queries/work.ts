import type { ApplicationFilters } from "@jobpilot/contracts/application";
import type { ReviewStatus } from "@jobpilot/contracts/email";
import type { FeedKind } from "@jobpilot/contracts/feed";
import type { PaginationQuery } from "@jobpilot/contracts/pagination";
import type { PipelineFilters, PipelineJobsQuery } from "@jobpilot/contracts/pipeline";
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/api/client";
import { unwrap } from "@/api/error";
import { FULL_PAGE } from "./shared";

const APPLICATIONS = ["applications"] as const;
const FEEDS = ["feeds"] as const;
const EMAIL = ["email"] as const;
const COVER_LETTERS = ["cover-letters"] as const;
const ANALYTICS = ["analytics"] as const;
const NETWORKING = ["networking"] as const;
const PIPELINE = ["pipeline"] as const;

export const applicationQueries = {
  all: APPLICATIONS,
  list: (query: PaginationQuery & ApplicationFilters) =>
    queryOptions({
      queryKey: [...APPLICATIONS, "list", { ...query }],
      queryFn: () => unwrap(api.applications.get({ query })),
    }),
  /** Whole-account totals per status - the funnel tiles must not be page-scoped. */
  summary: (filters: Omit<ApplicationFilters, "status"> = {}) =>
    queryOptions({
      queryKey: [...APPLICATIONS, "summary", { ...filters }],
      queryFn: () => unwrap(api.applications.summary.get({ query: filters })),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: [...APPLICATIONS, "detail", id],
      queryFn: () => unwrap(api.applications({ id }).get()),
    }),
  search: (search: string) =>
    queryOptions({
      queryKey: [...APPLICATIONS, "search", search],
      queryFn: () =>
        unwrap(api.applications.get({ query: { ...FULL_PAGE, ...(search && { search }) } })),
    }),
};

export const pipelineQueries = {
  all: PIPELINE,
  jobs: (query: PipelineJobsQuery) =>
    queryOptions({
      queryKey: [...PIPELINE, "jobs", query],
      queryFn: () => unwrap(api.pipeline.jobs.get({ query })),
    }),
  counts: (filters: PipelineFilters) =>
    queryOptions({
      queryKey: [...PIPELINE, "counts", filters],
      queryFn: () => unwrap(api.pipeline.counts.get({ query: filters })),
    }),
};

export const feedQueries = {
  all: FEEDS,
  /** Every feed, or one kind; small enough to filter in the browser. */
  list: (kind?: FeedKind) =>
    queryOptions({
      queryKey: [...FEEDS, "list", kind ?? "all"],
      queryFn: () => unwrap(api.feeds.get({ query: kind ? { kind } : {} })),
    }),
  /** Skip/fail reasons aggregated server-side, so counts cover every job rather than one page. */
  reasons: (id: string) =>
    queryOptions({
      queryKey: [...FEEDS, "reasons", id],
      queryFn: () => unwrap(api.feeds({ id })["job-reasons"].get()),
    }),
};

export const emailQueries = {
  all: EMAIL,
  account: () =>
    queryOptions({
      queryKey: [...EMAIL, "account"],
      queryFn: () => unwrap(api.email.account.get()),
    }),
  oauthClient: () =>
    queryOptions({
      queryKey: [...EMAIL, "oauthClient"],
      queryFn: () => unwrap(api.email.oauth.client.get()),
    }),
  messages: (filter: ReviewStatus | null, page: PaginationQuery) =>
    queryOptions({
      queryKey: [...EMAIL, "messages", { filter, ...page }],
      queryFn: () =>
        unwrap(
          api.email.messages.get({ query: { ...page, ...(filter && { reviewStatus: filter }) } }),
        ),
    }),
  message: (messageId: string) =>
    queryOptions({
      queryKey: [...EMAIL, "message", messageId],
      queryFn: () => unwrap(api.email.messages({ id: messageId }).get()),
    }),
};

export const coverLetterQueries = {
  all: COVER_LETTERS,
  list: (query: PaginationQuery) =>
    queryOptions({
      queryKey: [...COVER_LETTERS, "list", query],
      queryFn: () => unwrap(api["cover-letters"].get({ query })),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: [...COVER_LETTERS, "detail", id],
      queryFn: () => unwrap(api["cover-letters"]({ id }).get()),
    }),
};

/** Cross-feed outreach; a feed's own drafts read through `feedQueries.networking`. */
export const networkingQueries = {
  all: NETWORKING,
  messages: (query: PaginationQuery) =>
    queryOptions({
      queryKey: [...NETWORKING, "messages", query],
      queryFn: () => unwrap(api.networking.messages.get({ query })),
    }),
  contacts: (query: PaginationQuery) =>
    queryOptions({
      queryKey: [...NETWORKING, "contacts", query],
      queryFn: () => unwrap(api.contacts.get({ query })),
    }),
};

export const analyticsQueries = {
  all: ANALYTICS,
  stats: () =>
    queryOptions({ queryKey: [...ANALYTICS, "stats"], queryFn: () => unwrap(api.analytics.get()) }),
};

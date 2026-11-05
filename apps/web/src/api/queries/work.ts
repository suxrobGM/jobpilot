import type { ApplicationFilters } from "@jobpilot/contracts/application";
import type {
  CampaignJobStatus,
  CampaignSource,
  CampaignStatus,
} from "@jobpilot/contracts/campaign";
import type { ReviewStatus } from "@jobpilot/contracts/email";
import type { PaginationQuery } from "@jobpilot/contracts/pagination";
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/api/client";
import { unwrap } from "@/api/error";
import { OPTIONS_PAGE } from "./shared";

const APPLICATIONS = ["applications"] as const;
const CAMPAIGNS = ["campaigns"] as const;
const EMAIL = ["email"] as const;
const COVER_LETTERS = ["cover-letters"] as const;
const ANALYTICS = ["analytics"] as const;
const NETWORKING = ["networking"] as const;

type CampaignListQuery = PaginationQuery & { status?: CampaignStatus[]; source?: CampaignSource };
type CampaignJobsQuery = PaginationQuery & { status?: CampaignJobStatus; search?: string };

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
        unwrap(api.applications.get({ query: { ...OPTIONS_PAGE, ...(search && { search }) } })),
    }),
};

export const campaignQueries = {
  all: CAMPAIGNS,
  list: (query: CampaignListQuery = OPTIONS_PAGE) =>
    queryOptions({
      queryKey: [...CAMPAIGNS, "list", query],
      queryFn: () => unwrap(api.campaigns.get({ query })),
    }),
  /** Whole-account totals - a page of campaigns can't back a dashboard count. */
  summary: () =>
    queryOptions({
      queryKey: [...CAMPAIGNS, "summary"],
      queryFn: () => unwrap(api.campaigns.summary.get()),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: [...CAMPAIGNS, "detail", id],
      queryFn: () => unwrap(api.campaigns({ id }).get()),
    }),
  /** Every cached page and filter of one campaign's jobs. */
  jobsOf: (id: string) => [...CAMPAIGNS, "jobs", id] as const,
  /** One server-filtered page of a campaign's jobs; filters apply across the whole campaign. */
  jobs: (id: string, params: CampaignJobsQuery) =>
    queryOptions({
      queryKey: [...campaignQueries.jobsOf(id), params],
      queryFn: () => unwrap(api.campaigns({ id }).jobs.get({ query: params })),
    }),
  /** Skip/fail reasons aggregated server-side, so counts cover every job rather than one page. */
  reasons: (id: string) =>
    queryOptions({
      queryKey: [...CAMPAIGNS, "reasons", id],
      queryFn: () => unwrap(api.campaigns({ id })["job-reasons"].get()),
    }),
  networkingOf: (id: string) => [...CAMPAIGNS, "networking", id] as const,
  networking: (id: string, query: PaginationQuery = OPTIONS_PAGE) =>
    queryOptions({
      queryKey: [...campaignQueries.networkingOf(id), query],
      queryFn: () => unwrap(api.campaigns({ id }).networking.messages.get({ query })),
    }),
};

/** The inbox list filter: a review status, or "all" for no filter. */
type InboxFilter = ReviewStatus | "all";

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
  messages: (filter: InboxFilter, page: PaginationQuery) =>
    queryOptions({
      queryKey: [...EMAIL, "messages", { filter, ...page }],
      queryFn: () =>
        unwrap(
          api.email.messages.get({
            query: { ...page, ...(filter === "all" ? {} : { reviewStatus: filter }) },
          }),
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

/** Cross-campaign outreach; a campaign's own drafts read through `campaignQueries.networking`. */
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

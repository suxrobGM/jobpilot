import type { ApplicationFilters } from "@jobpilot/contracts/application";
import type {
  CampaignJobStatus,
  CampaignSource,
  CampaignStatus,
} from "@jobpilot/contracts/campaign";
import type { ReviewStatus } from "@jobpilot/contracts/email";
import {
  DEFAULT_CURSOR_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type PaginationQuery,
} from "@jobpilot/contracts/pagination";
import type {
  PilotJournalKind,
  PilotQuestionStatus,
  PromotionStatus,
} from "@jobpilot/contracts/pilot";
import { api } from "@/api/client";
import { queryKeys } from "@/api/query-keys";

/**
 * A read that feeds a `<Select>` rather than a table wants the whole (small) collection, not a
 * page of it. One page at the API's cap is that read - and it stays bounded. Pass it explicitly
 * when the read is "everything matching this filter" rather than a pager's page.
 */
export const OPTIONS_PAGE: PaginationQuery = { page: 1, limit: MAX_PAGE_SIZE };

/**
 * Per-endpoint query defs: one (queryKey, queryFn) pair per read, mirroring the
 * `queryKeys` namespaces. Call sites pass these to `useApiQuery` instead of
 * re-inlining the pair, and inference flows the response type from the Eden client.
 */

export const authQueries = {
  me: () => ({ queryKey: queryKeys.auth.me(), queryFn: () => api.auth.me.get() }),
};

export const userQueries = {
  detail: () => ({ queryKey: queryKeys.user.detail(), queryFn: () => api.user.get() }),
  portfolio: () => ({
    queryKey: queryKeys.user.portfolio(),
    queryFn: () => api.user.portfolio.get(),
  }),
  portfolioPreview: () => ({
    queryKey: queryKeys.user.portfolioPreview(),
    queryFn: () => api.user.portfolio.preview.get(),
  }),
};

export const leaderboardQueries = {
  list: (window: "week" | "month" | "all") => ({
    queryKey: queryKeys.leaderboard.list(window),
    queryFn: () => api.public.portfolio.leaderboard.get({ query: { window } }),
  }),
};

export const credentialQueries = {
  list: () => ({ queryKey: queryKeys.credentials.list(), queryFn: () => api.credentials.get() }),
};

export const resumeQueries = {
  list: () => ({ queryKey: queryKeys.resume.list(), queryFn: () => api.resumes.get() }),
  detail: (id: string) => ({
    queryKey: queryKeys.resume.detail(id),
    queryFn: () => api.resumes({ id }).get(),
  }),
  variants: (resumeId: string) => ({
    queryKey: queryKeys.resume.variants(resumeId),
    queryFn: () => api.resumes({ id: resumeId }).variants.get(),
  }),
  variantDetail: (id: string) => ({
    queryKey: queryKeys.resume.variantDetail(id),
    queryFn: () => api.resumes.variants({ id }).get(),
  }),
};

export const jobBoardQueries = {
  list: () => ({ queryKey: queryKeys.jobBoards.list(), queryFn: () => api["job-boards"].get() }),
};

export const applicationQueries = {
  list: (query: PaginationQuery & ApplicationFilters) => ({
    queryKey: queryKeys.applications.list({ ...query }),
    queryFn: () => api.applied.get({ query }),
  }),
  /** Whole-account totals per status - the funnel tiles must not be page-scoped. */
  summary: (filters: Omit<ApplicationFilters, "status"> = {}) => ({
    queryKey: queryKeys.applications.summary({ ...filters }),
    queryFn: () => api.applied.summary.get({ query: filters }),
  }),
  detail: (id: string) => ({
    queryKey: queryKeys.applications.detail(id),
    queryFn: () => api.applied({ id }).get(),
  }),
  search: (search: string) => ({
    queryKey: queryKeys.applications.search(search),
    queryFn: () => api.applied.get({ query: { ...OPTIONS_PAGE, ...(search && { search }) } }),
  }),
};

export const campaignQueries = {
  list: (
    query: PaginationQuery & { status?: CampaignStatus[]; source?: CampaignSource } = OPTIONS_PAGE,
  ) => ({
    queryKey: queryKeys.campaigns.list(query),
    queryFn: () => api.campaigns.get({ query }),
  }),
  detail: (id: string) => ({
    queryKey: queryKeys.campaigns.detail(id),
    queryFn: () => api.campaigns({ id }).get(),
  }),
  /** One server-filtered page of a campaign's jobs; filters apply across the whole campaign. */
  jobs: (
    id: string,
    params: PaginationQuery & { status?: CampaignJobStatus; search?: string },
  ) => ({
    queryKey: queryKeys.campaigns.jobs(id, params),
    queryFn: () => api.campaigns({ id }).jobs.get({ query: params }),
  }),
  /** Skip/fail reasons aggregated server-side, so counts cover every job rather than one page. */
  reasons: (id: string) => ({
    queryKey: queryKeys.campaigns.reasons(id),
    queryFn: () => api.campaigns({ id }).jobs.reasons.get(),
  }),
  networking: (campaignId: string, query: PaginationQuery = OPTIONS_PAGE) => ({
    queryKey: queryKeys.campaigns.networking(campaignId, query),
    queryFn: () => api.campaigns({ id: campaignId }).networking.get({ query }),
  }),
};

/** The inbox list filter: a review status, or "all" for no filter. */
export type InboxFilter = ReviewStatus | "all";

export const emailQueries = {
  account: () => ({ queryKey: queryKeys.email.account(), queryFn: () => api.email.account.get() }),
  oauthClient: () => ({
    queryKey: queryKeys.email.oauthClient(),
    queryFn: () => api.email.oauth.client.get(),
  }),
  messages: (filter: InboxFilter, page: PaginationQuery) => ({
    queryKey: queryKeys.email.messages({ filter, ...page }),
    queryFn: () =>
      api.email.messages.get({
        query: { ...page, ...(filter === "all" ? {} : { reviewStatus: filter }) },
      }),
  }),
  message: (messageId: string) => ({
    queryKey: queryKeys.email.message(messageId),
    queryFn: () => api.email.messages({ id: messageId }).get(),
  }),
};

export const upworkProposalQueries = {
  list: (query: PaginationQuery & { status?: string }) => ({
    queryKey: queryKeys.upworkProposals.list(query),
    queryFn: () => api.upwork.proposals.get({ query }),
  }),
  detail: (id: string) => ({
    queryKey: queryKeys.upworkProposals.detail(id),
    queryFn: () => api.upwork.proposals({ id }).get(),
  }),
};

export const upworkProfileQueries = {
  detail: () => ({
    queryKey: queryKeys.upworkProfile.detail(),
    queryFn: () => api.upwork.profile.get(),
  }),
};

export const coverLetterQueries = {
  list: (query: PaginationQuery) => ({
    queryKey: queryKeys.coverLetters.list(query),
    queryFn: () => api["cover-letters"].get({ query }),
  }),
};

export const analyticsQueries = {
  stats: () => ({ queryKey: queryKeys.analytics.stats(), queryFn: () => api.analytics.get() }),
};

export const pilotQueries = {
  state: () => ({ queryKey: queryKeys.pilot.state(), queryFn: () => api.pilot.get() }),
  todayOutcomes: () => ({
    queryKey: queryKeys.pilot.todayOutcomes(),
    queryFn: () => api.pilot.stats.today.get(),
  }),
  searches: () => ({
    queryKey: queryKeys.pilot.searches(),
    queryFn: () => api.pilot.searches.get(),
  }),
  instructionsImpact: () => ({
    queryKey: queryKeys.pilot.instructionsImpact(),
    queryFn: () => api.pilot.instructions.impact.get(),
  }),
  agenda: () => ({
    queryKey: queryKeys.pilot.agenda(),
    queryFn: async () => {
      const result = await api.pilot.agenda.get();
      return { ...result, data: result.data?.agenda ?? null };
    },
  }),
  // Sorted so the same filter set toggled in a different order shares one cache entry.
  journal: (kinds: PilotJournalKind[] = []) => {
    const filter = [...kinds].sort();
    return {
      queryKey: queryKeys.pilot.journal({ kinds: filter }),
      queryFn: () =>
        api.pilot.journal.get({
          query: {
            limit: DEFAULT_CURSOR_PAGE_SIZE,
            ...(filter.length > 0 ? { kinds: filter } : {}),
          },
        }),
    };
  },
  questions: (status?: PilotQuestionStatus) => ({
    queryKey: queryKeys.pilot.questions({ status: status ?? "all" }),
    queryFn: () => api.pilot.questions.get({ query: status ? { status } : {} }),
  }),
  promotions: (status?: PromotionStatus, page: PaginationQuery = OPTIONS_PAGE) => ({
    queryKey: queryKeys.pilot.promotions({ status: status ?? "all", ...page }),
    queryFn: () => api.pilot.promotions.get({ query: { ...page, ...(status && { status }) } }),
  }),
  pushKey: () => ({
    queryKey: queryKeys.pilot.pushKey(),
    queryFn: () => api.push["vapid-key"].get(),
  }),
  pushDevices: () => ({
    queryKey: queryKeys.pilot.pushDevices(),
    queryFn: () => api.push.subscriptions.get(),
  }),
};

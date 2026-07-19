import type { CampaignSource, CampaignStatus } from "@jobpilot/contracts/campaign";
import type { ReviewStatus } from "@jobpilot/contracts/email";
import type { PromotionStatus, QuestionStatus } from "@jobpilot/contracts/pilot";
import type { QueueStatus } from "@jobpilot/contracts/queue";
import { api } from "@/api/client";
import { queryKeys } from "@/api/query-keys";

/**
 * Per-endpoint query defs: one (queryKey, queryFn) pair per read, mirroring the
 * `queryKeys` namespaces. Call sites pass these to `useApiQuery` instead of
 * re-inlining the pair, and inference flows the response type from the Eden client.
 */

export const authQueries = {
  me: () => ({ queryKey: queryKeys.auth.me(), queryFn: () => api.auth.me.get() }),
};

export const profileQueries = {
  detail: () => ({ queryKey: queryKeys.profile.detail(), queryFn: () => api.profile.get() }),
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
};

export const jobBoardQueries = {
  list: () => ({ queryKey: queryKeys.jobBoards.list(), queryFn: () => api["job-boards"].get() }),
};

export const applicationQueries = {
  list: () => ({
    queryKey: queryKeys.applications.list({}),
    queryFn: () => api.applied.get({ query: {} }),
  }),
  detail: (id: string) => ({
    queryKey: queryKeys.applications.detail(id),
    queryFn: () => api.applied({ id }).get(),
  }),
  search: (search: string) => ({
    queryKey: queryKeys.applications.search(search),
    queryFn: () => api.applied.get({ query: search ? { search } : {} }),
  }),
};

export const campaignQueries = {
  list: (filters: { status?: CampaignStatus; source?: CampaignSource } = {}) => ({
    queryKey: queryKeys.campaigns.list(filters),
    queryFn: () => api.campaigns.get({ query: filters }),
  }),
  detail: (id: string) => ({
    queryKey: queryKeys.campaigns.detail(id),
    queryFn: () => api.campaigns({ id }).get(),
  }),
  networking: (campaignId: string) => ({
    queryKey: queryKeys.campaigns.networking(campaignId),
    queryFn: () => api.campaigns({ id: campaignId }).networking.get(),
  }),
};

export const contactQueries = {
  list: () => ({ queryKey: queryKeys.contacts.list(), queryFn: () => api.contacts.get() }),
};

export const queueQueries = {
  list: (filters: { status?: QueueStatus } = {}) => ({
    queryKey: queryKeys.queue.list(filters),
    queryFn: () => api.queue.get({ query: filters }),
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
  messages: (filter: InboxFilter) => ({
    queryKey: queryKeys.email.messages({ filter }),
    queryFn: () =>
      api.email.messages.get({ query: filter === "all" ? {} : { reviewStatus: filter } }),
  }),
  message: (messageId: string) => ({
    queryKey: queryKeys.email.message(messageId),
    queryFn: () => api.email.messages({ id: messageId }).get(),
  }),
};

export const upworkProposalQueries = {
  list: () => ({
    queryKey: queryKeys.upworkProposals.list(),
    queryFn: () => api.upwork.proposals.get(),
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
  list: () => ({
    queryKey: queryKeys.coverLetters.list(),
    queryFn: () => api["cover-letters"].get(),
  }),
};

export const analyticsQueries = {
  stats: () => ({ queryKey: queryKeys.analytics.stats(), queryFn: () => api.analytics.get() }),
};

/** Journal page size; shared by the first-page query and the load-more fetch. */
export const PILOT_JOURNAL_PAGE_SIZE = 50;

export const pilotQueries = {
  state: () => ({ queryKey: queryKeys.pilot.state(), queryFn: () => api.pilot.get() }),
  agenda: () => ({ queryKey: queryKeys.pilot.agenda(), queryFn: () => api.pilot.agenda.get() }),
  journal: () => ({
    queryKey: queryKeys.pilot.journal(),
    queryFn: () => api.pilot.journal.get({ query: { limit: PILOT_JOURNAL_PAGE_SIZE } }),
  }),
  questions: (status?: QuestionStatus) => ({
    queryKey: queryKeys.pilot.questions({ status: status ?? "all" }),
    queryFn: () => api.pilot.questions.get({ query: status ? { status } : {} }),
  }),
  promotions: (status?: PromotionStatus) => ({
    queryKey: queryKeys.pilot.promotions({ status: status ?? "all" }),
    queryFn: () => api.pilot.promotions.get({ query: status ? { status } : {} }),
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

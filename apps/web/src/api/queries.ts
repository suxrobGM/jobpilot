import { api } from "@/api/client";
import type { ApiQueryDef } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { EmailMessageDetailDto } from "@/api/types";

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
    queryKey: [...queryKeys.applications.all, "search", search] as const,
    queryFn: () => api.applied.get({ query: search ? { search } : {} }),
  }),
};

export const campaignQueries = {
  list: (filters?: { status?: string; source?: string }) => ({
    queryKey: queryKeys.campaigns.list(filters),
    queryFn: () => (filters ? api.campaigns.get({ query: filters }) : api.campaigns.get()),
  }),
  detail: (id: string) => ({
    queryKey: queryKeys.campaigns.detail(id),
    queryFn: () => api.campaigns({ id }).get(),
  }),
  outreach: (campaignId: string) => ({
    queryKey: queryKeys.campaigns.outreach(campaignId),
    queryFn: () => api.campaigns({ id: campaignId }).outreach.get(),
  }),
};

export const contactQueries = {
  list: () => ({ queryKey: queryKeys.contacts.list(), queryFn: () => api.contacts.get() }),
};

export const queueQueries = {
  list: (filters: { status?: string } = {}) => ({
    queryKey: queryKeys.queue.list(filters),
    queryFn: () => api.queue.get({ query: filters }),
  }),
};

export const emailQueries = {
  account: () => ({ queryKey: queryKeys.email.account(), queryFn: () => api.email.account.get() }),
  oauthClient: () => ({
    queryKey: queryKeys.email.oauthClient(),
    queryFn: () => api.email.oauth.client.get(),
  }),
  messages: (filter: string) => ({
    queryKey: queryKeys.email.messages({ filter }),
    queryFn: () =>
      api.email.messages.get({ query: filter === "all" ? {} : { reviewStatus: filter } }),
  }),
  // Null id yields an empty result so the def stays callable while disabled (enabled: id !== null).
  message: (messageId: string | null): ApiQueryDef<EmailMessageDetailDto> => ({
    queryKey: [...queryKeys.email.all, "message", messageId ?? -1] as const,
    queryFn: () =>
      messageId == null
        ? Promise.resolve({ data: null, error: null })
        : api.email.messages({ id: messageId }).get(),
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

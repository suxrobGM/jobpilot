export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    me: () => [...queryKeys.auth.all, "me"] as const,
  },

  profile: {
    all: ["profile"] as const,
    detail: () => [...queryKeys.profile.all, "detail"] as const,
  },

  credentials: {
    all: ["credentials"] as const,
    list: () => [...queryKeys.credentials.all, "list"] as const,
  },

  resume: {
    all: ["resume"] as const,
    list: () => [...queryKeys.resume.all, "list"] as const,
    detail: (id: string) => [...queryKeys.resume.all, "detail", id] as const,
    variants: (resumeId: string) =>
      [...queryKeys.resume.all, "variants", "list", resumeId] as const,
    variantDetail: (id: string) => [...queryKeys.resume.all, "variants", "detail", id] as const,
  },

  jobBoards: {
    all: ["job-boards"] as const,
    list: () => [...queryKeys.jobBoards.all, "list"] as const,
    detail: (id: string) => [...queryKeys.jobBoards.all, "detail", id] as const,
  },

  applications: {
    all: ["applications"] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.applications.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.applications.all, "detail", id] as const,
    search: (term: string) => [...queryKeys.applications.all, "search", term] as const,
  },

  dashboard: {
    all: ["dashboard"] as const,
    stats: () => [...queryKeys.dashboard.all, "stats"] as const,
  },

  campaigns: {
    all: ["campaigns"] as const,
    list: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.campaigns.all, "list", filters] as const,
    detail: (campaignId: string) => [...queryKeys.campaigns.all, "detail", campaignId] as const,
    outreach: (campaignId: string) => [...queryKeys.campaigns.all, "outreach", campaignId] as const,
    stats: () => [...queryKeys.campaigns.all, "stats"] as const,
  },

  contacts: {
    all: ["contacts"] as const,
    list: () => [...queryKeys.contacts.all, "list"] as const,
  },

  queue: {
    all: ["queue"] as const,
    list: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.queue.all, "list", filters] as const,
  },

  email: {
    all: ["email"] as const,
    account: () => [...queryKeys.email.all, "account"] as const,
    oauthClient: () => [...queryKeys.email.all, "oauthClient"] as const,
    messages: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.email.all, "messages", filters] as const,
    message: (id: string) => [...queryKeys.email.all, "message", id] as const,
  },

  workspace: {
    // SSE invalidation namespace for the cross-campaign workspace live-refresh feed.
    all: ["workspace"] as const,
  },

  analytics: {
    all: ["analytics"] as const,
    stats: () => [...queryKeys.analytics.all, "stats"] as const,
  },

  upworkProposals: {
    all: ["upwork-proposals"] as const,
    list: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.upworkProposals.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.upworkProposals.all, "detail", id] as const,
  },

  upworkProfile: {
    all: ["upwork-profile"] as const,
    detail: () => [...queryKeys.upworkProfile.all, "detail"] as const,
  },

  coverLetters: {
    all: ["cover-letters"] as const,
    list: () => [...queryKeys.coverLetters.all, "list"] as const,
    detail: (id: string) => [...queryKeys.coverLetters.all, "detail", id] as const,
  },

  pilot: {
    all: ["pilot"] as const,
    state: () => [...queryKeys.pilot.all, "state"] as const,
    // Mount-fetch + manual refresh only; PilotLive never invalidates this key (agenda compile is costly).
    agenda: () => [...queryKeys.pilot.all, "agenda"] as const,
    journal: () => [...queryKeys.pilot.all, "journal"] as const,
    questionsAll: () => [...queryKeys.pilot.all, "questions"] as const,
    questions: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.pilot.questionsAll(), filters] as const,
    promotionsAll: () => [...queryKeys.pilot.all, "promotions"] as const,
    promotions: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.pilot.promotionsAll(), filters] as const,
    push: () => [...queryKeys.pilot.all, "push"] as const,
    pushKey: () => [...queryKeys.pilot.push(), "vapid-key"] as const,
    pushDevices: () => [...queryKeys.pilot.push(), "devices"] as const,
  },
} as const;

/** Named invalidation sets for useApiMutation's `invalidate:` option. */
export const invalidations = {
  resume: [queryKeys.resume.all, queryKeys.profile.all],
  campaign: [queryKeys.campaigns.all, queryKeys.workspace.all],
  queue: [queryKeys.queue.all, queryKeys.workspace.all],
  application: [queryKeys.applications.all, queryKeys.dashboard.all],
  // Approving a message can write an application status, so both trees go stale.
  emailReview: [queryKeys.email.all, queryKeys.applications.all],
} as const;

export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    me: () => [...queryKeys.auth.all, "me"] as const,
  },

  user: {
    all: ["user"] as const,
    detail: () => [...queryKeys.user.all, "detail"] as const,
    portfolio: () => [...queryKeys.user.all, "portfolio"] as const,
    portfolioPreview: () => [...queryKeys.user.all, "portfolio", "preview"] as const,
  },

  leaderboard: {
    all: ["leaderboard"] as const,
    list: (window: string) => [...queryKeys.leaderboard.all, window] as const,
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
    summary: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.applications.all, "summary", filters] as const,
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
    jobs: (campaignId: string, filters: Record<string, unknown> = {}) =>
      [...queryKeys.campaigns.all, "jobs", campaignId, filters] as const,
    reasons: (campaignId: string) => [...queryKeys.campaigns.all, "reasons", campaignId] as const,
    networking: (campaignId: string, filters: Record<string, unknown> = {}) =>
      [...queryKeys.campaigns.all, "networking", campaignId, filters] as const,
  },

  contacts: {
    all: ["contacts"] as const,
    list: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.contacts.all, "list", filters] as const,
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
    list: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.coverLetters.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.coverLetters.all, "detail", id] as const,
  },

  pilot: {
    all: ["pilot"] as const,
    state: () => [...queryKeys.pilot.all, "state"] as const,
    todayOutcomes: () => [...queryKeys.pilot.all, "today-outcomes"] as const,
    // Read-only view of the pilot's self-managed discovery searches.
    searches: () => [...queryKeys.pilot.all, "searches"] as const,
    // Mount-fetch + manual refresh only; PilotLive never invalidates this key (agenda compile is costly).
    agenda: () => [...queryKeys.pilot.all, "agenda"] as const,
    journalAll: () => [...queryKeys.pilot.all, "journal"] as const,
    journal: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.pilot.journalAll(), filters] as const,
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
  resume: [queryKeys.resume.all, queryKeys.user.all],
  campaign: [queryKeys.campaigns.all, queryKeys.workspace.all],
  application: [queryKeys.applications.all, queryKeys.dashboard.all],
  // Approving a message can write an application status, so both trees go stale.
  emailReview: [queryKeys.email.all, queryKeys.applications.all],
} as const;

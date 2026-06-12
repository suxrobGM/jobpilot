export const queryKeys = {
  profile: {
    all: ["profile"] as const,
    detail: () => [...queryKeys.profile.all, "detail"] as const,
  },

  profiles: {
    all: ["profiles"] as const,
    list: () => [...queryKeys.profiles.all, "list"] as const,
    active: () => [...queryKeys.profiles.all, "active"] as const,
  },

  credentials: {
    all: ["credentials"] as const,
    list: () => [...queryKeys.credentials.all, "list"] as const,
  },

  resume: {
    all: ["resume"] as const,
    list: () => [...queryKeys.resume.all, "list"] as const,
    detail: (id: number) => [...queryKeys.resume.all, "detail", id] as const,
    variants: (resumeId: number) =>
      [...queryKeys.resume.all, "variants", "list", resumeId] as const,
    variantDetail: (id: number) => [...queryKeys.resume.all, "variants", "detail", id] as const,
  },

  jobBoards: {
    all: ["job-boards"] as const,
    list: () => [...queryKeys.jobBoards.all, "list"] as const,
    detail: (id: number) => [...queryKeys.jobBoards.all, "detail", id] as const,
  },

  applications: {
    all: ["applications"] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.applications.all, "list", filters] as const,
    detail: (id: number) => [...queryKeys.applications.all, "detail", id] as const,
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
    messages: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.email.all, "messages", filters] as const,
  },

  pipeline: {
    all: ["pipeline"] as const,
    column: (stage: string, filters: object = {}) =>
      [...queryKeys.pipeline.all, "column", stage, filters] as const,
    total: (stage: string) => [...queryKeys.pipeline.all, "total", stage] as const,
  },

  analytics: {
    all: ["analytics"] as const,
    stats: () => [...queryKeys.analytics.all, "stats"] as const,
  },

  upworkProposals: {
    all: ["upwork-proposals"] as const,
    list: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.upworkProposals.all, "list", filters] as const,
    detail: (id: number) => [...queryKeys.upworkProposals.all, "detail", id] as const,
  },

  upworkProfile: {
    all: ["upwork-profile"] as const,
    detail: () => [...queryKeys.upworkProfile.all, "detail"] as const,
  },

  coverLetters: {
    all: ["cover-letters"] as const,
    list: () => [...queryKeys.coverLetters.all, "list"] as const,
    detail: (id: number) => [...queryKeys.coverLetters.all, "detail", id] as const,
  },
} as const;

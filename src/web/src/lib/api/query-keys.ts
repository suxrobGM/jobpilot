export const queryKeys = {
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

  runs: {
    all: ["runs"] as const,
    list: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.runs.all, "list", filters] as const,
    detail: (runId: string) => [...queryKeys.runs.all, "detail", runId] as const,
    stats: () => [...queryKeys.runs.all, "stats"] as const,
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
    column: (stage: string, filters: Record<string, unknown> = {}) =>
      [...queryKeys.pipeline.all, "column", stage, filters] as const,
    total: (stage: string) => [...queryKeys.pipeline.all, "total", stage] as const,
  },
} as const;

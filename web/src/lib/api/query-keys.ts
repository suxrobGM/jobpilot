export const queryKeys = {
  profile: {
    all: ["profile"] as const,
    detail: () => [...queryKeys.profile.all, "detail"] as const,
  },

  credentials: {
    all: ["credentials"] as const,
    list: () => [...queryKeys.credentials.all, "list"] as const,
  },

  resumes: {
    all: ["resumes"] as const,
    list: () => [...queryKeys.resumes.all, "list"] as const,
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
} as const;

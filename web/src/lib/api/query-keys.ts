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
} as const;

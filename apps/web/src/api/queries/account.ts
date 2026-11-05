import { queryOptions } from "@tanstack/react-query";
import { api } from "@/api/client";
import { unwrap } from "@/api/error";
import type { LeaderboardWindow } from "@/api/types";

const AUTH = ["auth"] as const;
const USER = ["user"] as const;
const LEADERBOARD = ["leaderboard"] as const;
const CREDENTIALS = ["credentials"] as const;
const RESUME = ["resume"] as const;
const JOB_BOARDS = ["job-boards"] as const;

export const authQueries = {
  all: AUTH,
  me: () => queryOptions({ queryKey: [...AUTH, "me"], queryFn: () => unwrap(api.auth.me.get()) }),
};

export const userQueries = {
  all: USER,
  detail: () =>
    queryOptions({ queryKey: [...USER, "detail"], queryFn: () => unwrap(api.user.get()) }),
  portfolio: () =>
    queryOptions({
      queryKey: [...USER, "portfolio"],
      queryFn: () => unwrap(api.user.portfolio.get()),
    }),
  portfolioPreview: () =>
    queryOptions({
      queryKey: [...USER, "portfolio", "preview"],
      queryFn: () => unwrap(api.user.portfolio.preview.get()),
    }),
};

export const leaderboardQueries = {
  all: LEADERBOARD,
  list: (window: LeaderboardWindow) =>
    queryOptions({
      queryKey: [...LEADERBOARD, window],
      queryFn: () => unwrap(api.public.portfolios.leaderboard.get({ query: { window } })),
    }),
};

export const credentialQueries = {
  all: CREDENTIALS,
  list: () =>
    queryOptions({
      queryKey: [...CREDENTIALS, "list"],
      queryFn: () => unwrap(api.credentials.get()),
    }),
};

export const resumeQueries = {
  all: RESUME,
  list: () =>
    queryOptions({ queryKey: [...RESUME, "list"], queryFn: () => unwrap(api.resumes.get()) }),
  detail: (id: string) =>
    queryOptions({
      queryKey: [...RESUME, "detail", id],
      queryFn: () => unwrap(api.resumes({ id }).get()),
    }),
  variants: (resumeId: string) =>
    queryOptions({
      queryKey: [...RESUME, "variants", "list", resumeId],
      queryFn: () => unwrap(api.resumes({ id: resumeId }).variants.get()),
    }),
  variantDetail: (id: string) =>
    queryOptions({
      queryKey: [...RESUME, "variants", "detail", id],
      queryFn: () => unwrap(api.resumes.variants({ id }).get()),
    }),
};

export const jobBoardQueries = {
  all: JOB_BOARDS,
  list: () =>
    queryOptions({
      queryKey: [...JOB_BOARDS, "list"],
      queryFn: () => unwrap(api["job-boards"].get()),
    }),
  catalog: () =>
    queryOptions({
      queryKey: [...JOB_BOARDS, "catalog"],
      queryFn: () => unwrap(api["job-boards"].catalog.get()),
    }),
};

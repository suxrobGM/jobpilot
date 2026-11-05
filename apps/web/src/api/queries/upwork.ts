import type { PaginationQuery } from "@jobpilot/contracts/pagination";
import type {
  UpworkInboxKind,
  UpworkInboxStatus,
  UpworkProposalStatus,
} from "@jobpilot/contracts/upwork";
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/api/client";
import { unwrap } from "@/api/error";

const PROPOSALS = ["upwork-proposals"] as const;
const PROFILE = ["upwork-profile"] as const;
const ACCOUNT = ["upwork-account"] as const;
const INBOX = ["upwork-inbox"] as const;

type ProposalListQuery = PaginationQuery & { status?: UpworkProposalStatus };
type InboxListQuery = PaginationQuery & { kind?: UpworkInboxKind; status?: UpworkInboxStatus };

export const upworkProposalQueries = {
  all: PROPOSALS,
  list: (query: ProposalListQuery) =>
    queryOptions({
      queryKey: [...PROPOSALS, "list", query],
      queryFn: () => unwrap(api.upwork.proposals.get({ query })),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: [...PROPOSALS, "detail", id],
      queryFn: () => unwrap(api.upwork.proposals({ id }).get()),
    }),
};

export const upworkProfileQueries = {
  all: PROFILE,
  detail: () =>
    queryOptions({
      queryKey: [...PROFILE, "detail"],
      queryFn: () => unwrap(api.upwork.profile.get()),
    }),
};

export const upworkAccountQueries = {
  all: ACCOUNT,
  detail: () =>
    queryOptions({
      queryKey: [...ACCOUNT, "detail"],
      queryFn: () => unwrap(api.upwork.account.get()),
    }),
};

export const upworkInboxQueries = {
  all: INBOX,
  list: (query: InboxListQuery) =>
    queryOptions({
      queryKey: [...INBOX, "list", query],
      queryFn: () => unwrap(api.upwork.inbox.get({ query })),
    }),
};

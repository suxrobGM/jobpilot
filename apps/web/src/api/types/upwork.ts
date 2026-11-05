import type { Body, Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

export type UpworkProposalDto = Data<typeof api.upwork.proposals.get>["items"][number];

export type UpworkProfileDto = NonNullable<Data<typeof api.upwork.profile.get>>;

export type CreateUpworkProposalRequest = Body<typeof api.upwork.proposals.post>;

export type UpdateUpworkProposalRequest = Body<ReturnType<typeof api.upwork.proposals>["patch"]>;

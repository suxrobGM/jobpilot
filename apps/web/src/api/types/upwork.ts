import type { Body, Data } from "@jobpilot/api-client";
import type { api } from "@/api/eden";

/** An Upwork proposal, inferred from `GET /api/upwork/proposals`. */
export type UpworkProposalDto = Data<typeof api.upwork.proposals.get>[number];

/** The Upwork profile-enhancement record, from `GET /api/upwork/profile`. */
export type UpworkProfileDto = NonNullable<Data<typeof api.upwork.profile.get>>;

/** Create-proposal request body, from `POST /api/upwork/proposals`. */
export type CreateUpworkProposalRequest = Body<typeof api.upwork.proposals.post>;

/** Update-proposal request body, from `PATCH /api/upwork/proposals/:id`. */
export type UpdateUpworkProposalRequest = Body<ReturnType<typeof api.upwork.proposals>["patch"]>;

import {
  UPWORK_PROPOSAL_OUTCOMES,
  UPWORK_PROPOSAL_STATUSES,
  type UpworkProposalOutcome,
  type UpworkProposalStatus,
} from "@/api/contracts/upwork";

export const STATUS_COLOR: Record<
  UpworkProposalStatus,
  "default" | "info" | "success" | "warning"
> = {
  draft: "default",
  submitted: "info",
  closed: "success",
};

export const STATUS_LABEL: Record<UpworkProposalStatus, string> = {
  draft: "draft",
  submitted: "submitted",
  closed: "closed",
};

export const STATUS_OPTIONS = UPWORK_PROPOSAL_STATUSES.map((value) => ({
  value,
  label: STATUS_LABEL[value],
}));

export const OUTCOME_LABEL: Record<UpworkProposalOutcome, string> = {
  hired: "hired",
  declined: "declined",
  no_response: "no response",
};

export const OUTCOME_OPTIONS = UPWORK_PROPOSAL_OUTCOMES.map((value) => ({
  value,
  label: OUTCOME_LABEL[value],
}));

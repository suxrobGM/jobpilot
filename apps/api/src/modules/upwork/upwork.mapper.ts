import type {
  PortfolioProject,
  ScreeningAnswer,
  UpworkProfileStatus,
  UpworkProposalOutcome,
  UpworkProposalSource,
  UpworkProposalStatus,
} from "@jobpilot/contracts/upwork";
import type { UpworkProfile } from "@/generated/prisma/client";

function parsePortfolio(json: string): PortfolioProject[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as PortfolioProject[]) : [];
  } catch {
    return [];
  }
}

export function toUpworkProfileDto(row: UpworkProfile) {
  return {
    id: row.id,
    currentTitle: row.currentTitle,
    currentOverview: row.currentOverview,
    currentHourlyRate: row.currentHourlyRate,
    currentPortfolio: parsePortfolio(row.currentPortfolio),
    suggestedTitle: row.suggestedTitle,
    suggestedOverview: row.suggestedOverview,
    suggestedHourlyRate: row.suggestedHourlyRate,
    suggestedPortfolio: parsePortfolio(row.suggestedPortfolio),
    status: row.status as UpworkProfileStatus,
    updatedAt: row.updatedAt.toISOString(),
    appliedAt: row.appliedAt?.toISOString() ?? null,
  };
}

/** Decode a proposal row's JSON-encoded screening answers for the API shape. */
export function decodeUpworkProposal<
  T extends {
    screeningAnswers: string;
    status: string;
    outcome: string | null;
    source: string;
    createdAt: Date;
    updatedAt: Date;
    submittedAt: Date | null;
  },
>(proposal: T) {
  return {
    ...proposal,
    screeningAnswers: JSON.parse(proposal.screeningAnswers) as ScreeningAnswer[],
    status: proposal.status as UpworkProposalStatus,
    outcome: proposal.outcome as UpworkProposalOutcome | null,
    source: proposal.source as UpworkProposalSource,
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: proposal.updatedAt.toISOString(),
    submittedAt: proposal.submittedAt?.toISOString() ?? null,
  };
}

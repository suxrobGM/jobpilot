import type {
  PortfolioProject,
  ScreeningAnswer,
  UpworkInboxKind,
  UpworkInboxStatus,
  UpworkProfileStatus,
  UpworkProposalOutcome,
  UpworkProposalSource,
  UpworkProposalStatus,
} from "@jobpilot/contracts/upwork";
import type { UpworkInboxItem, UpworkProfile } from "@/generated/prisma/client";

function parseArray<T>(json: string): T[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
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
    currentPortfolio: parseArray<PortfolioProject>(row.currentPortfolio),
    currentSkills: parseArray<string>(row.currentSkills),
    suggestedTitle: row.suggestedTitle,
    suggestedOverview: row.suggestedOverview,
    suggestedHourlyRate: row.suggestedHourlyRate,
    suggestedPortfolio: parseArray<PortfolioProject>(row.suggestedPortfolio),
    suggestedSkills: parseArray<string>(row.suggestedSkills),
    status: row.status as UpworkProfileStatus,
    updatedAt: row.updatedAt,
    appliedAt: row.appliedAt,
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
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    submittedAt: proposal.submittedAt,
  };
}

/** Decode an inbox row's JSON `raw` payload for the API shape. */
export function toUpworkInboxItemDto(row: UpworkInboxItem) {
  let raw: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      raw = parsed as Record<string, unknown>;
    }
  } catch {
    // A row written before a schema change is still worth showing without its raw payload.
  }
  return {
    id: row.id,
    upworkId: row.upworkId,
    kind: row.kind as UpworkInboxKind,
    title: row.title,
    clientName: row.clientName,
    jobUrl: row.jobUrl,
    body: row.body,
    status: row.status as UpworkInboxStatus,
    receivedAt: row.receivedAt,
    raw,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

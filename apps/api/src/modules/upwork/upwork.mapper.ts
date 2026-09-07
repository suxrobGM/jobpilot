import type { PortfolioProject, ScreeningAnswer } from "@jobpilot/contracts/upwork";
import type { UpworkInboxItem, UpworkProfile, UpworkProposal } from "@/generated/prisma/client";

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
    status: row.status,
    updatedAt: row.updatedAt,
    appliedAt: row.appliedAt,
  };
}

/** Decode a proposal row's JSON-encoded screening answers for the API shape. */
export function decodeUpworkProposal(proposal: UpworkProposal) {
  return {
    ...proposal,
    screeningAnswers: JSON.parse(proposal.screeningAnswers) as ScreeningAnswer[],
  };
}

export function toUpworkInboxItemDto(row: Omit<UpworkInboxItem, "raw">) {
  return {
    id: row.id,
    upworkId: row.upworkId,
    kind: row.kind,
    title: row.title,
    clientName: row.clientName,
    jobUrl: row.jobUrl,
    body: row.body,
    status: row.status,
    receivedAt: row.receivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

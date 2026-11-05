import { portfolioProjectSchema, screeningAnswerSchema } from "@jobpilot/contracts/upwork";
import { z } from "zod/v4";
import type { UpworkInboxItem, UpworkProfile, UpworkProposal } from "@/generated/prisma/client";

const portfolioSchema = z.array(portfolioProjectSchema);
const screeningAnswersSchema = z.array(screeningAnswerSchema);

export function toUpworkProfileDto(row: UpworkProfile) {
  return {
    id: row.id,
    currentTitle: row.currentTitle,
    currentOverview: row.currentOverview,
    currentHourlyRate: row.currentHourlyRate,
    currentPortfolio: portfolioSchema.parse(row.currentPortfolio),
    currentSkills: row.currentSkills,
    suggestedTitle: row.suggestedTitle,
    suggestedOverview: row.suggestedOverview,
    suggestedHourlyRate: row.suggestedHourlyRate,
    suggestedPortfolio: portfolioSchema.parse(row.suggestedPortfolio),
    suggestedSkills: row.suggestedSkills,
    status: row.status,
    updatedAt: row.updatedAt,
    appliedAt: row.appliedAt,
  };
}

export function decodeUpworkProposal(proposal: UpworkProposal) {
  return { ...proposal, screeningAnswers: screeningAnswersSchema.parse(proposal.screeningAnswers) };
}

export function toUpworkInboxItemDto(row: Omit<UpworkInboxItem, "payload">) {
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

import { z } from "zod/v4";
import { createUpworkProposalSchema, ScreeningAnswer } from "@/api/contracts/upwork";
import type { Prisma } from "@/generated/prisma/client";
import { upworkChannel } from "@/lib/sse/channels/upwork";
import { publish } from "@/lib/sse/server";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

const querySchema = z.object({
  status: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

export const GET = api.route({ query: querySchema }, async ({ query, profileId }) => {
  const { status, search } = query;

  const where: Prisma.UpworkProposalWhereInput = { profileId };
  if (status) {
    where.status = status;
  }
  if (search) {
    where.OR = [{ jobTitle: { contains: search } }, { clientName: { contains: search } }];
  }

  const proposals = await db.upworkProposal.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  return proposals.map((proposal) => ({
    ...proposal,
    screeningAnswers: JSON.parse(proposal.screeningAnswers) as ScreeningAnswer[],
  }));
});

export const POST = api.route({ body: createUpworkProposalSchema }, async ({ body, profileId }) => {
  const proposal = await db.upworkProposal.create({
    data: {
      profileId,
      jobTitle: body.jobTitle,
      clientName: body.clientName ?? null,
      jobUrl: body.jobUrl ?? null,
      jobDescription: body.jobDescription ?? null,
      proposalText: body.proposalText ?? "",
      screeningAnswers: JSON.stringify(body.screeningAnswers ?? []),
      status: body.status ?? "draft",
      notes: body.notes ?? null,
      source: body.source ?? "manual",
      campaignId: body.campaignId ?? null,
      jobKey: body.jobKey ?? null,
    },
  });

  publish(upworkChannel, { profileId }, { type: "proposal.created", id: proposal.id });

  return {
    ...proposal,
    screeningAnswers: JSON.parse(proposal.screeningAnswers) as ScreeningAnswer[],
  };
});

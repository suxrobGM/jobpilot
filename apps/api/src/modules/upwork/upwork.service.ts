import type {
  UpdateUpworkProfileInput,
  UpworkClient,
  UpworkProposalInput,
  UpworkProposalPatch,
  UpworkQualityResult,
} from "@jobpilot/contracts/upwork";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { scoreUpworkClient } from "./upwork-quality";
import { decodeUpworkProposal, toUpworkProfileDto } from "./upwork.mapper";

/** Plain column writes — shared by upsert's create and update (no Prisma field-op wrappers). */
interface UpworkProfileFields {
  currentTitle?: string | null;
  currentOverview?: string | null;
  currentHourlyRate?: string | null;
  currentPortfolio?: string;
  suggestedTitle?: string | null;
  suggestedOverview?: string | null;
  suggestedHourlyRate?: string | null;
  suggestedPortfolio?: string;
  status?: string;
  appliedAt?: Date | null;
}

@singleton()
export class UpworkService {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Client-quality scoring (profile-independent, deterministic) ────────────
  /**
   * Deterministic Upwork client/job quality assessment used by the `upwork-search`
   * skill to smart-filter postings. Profile-independent, like a calculator.
   */
  scoreClientQuality(client: UpworkClient): UpworkQualityResult {
    return scoreUpworkClient(client);
  }

  // ── Profile enhancement ────────────────────────────────────────────────────
  async getProfile(profileId: number) {
    const row = await this.prisma.upworkProfile.findUnique({ where: { profileId } });
    return row ? toUpworkProfileDto(row) : null;
  }

  /**
   * Create or update the profile-enhancement record. Only provided fields are
   * written; portfolio arrays are JSON-encoded. Moving to `applied` stamps
   * `appliedAt` (set by the skill after it writes the live Upwork profile).
   */
  async upsertProfile(profileId: number, input: UpdateUpworkProfileInput) {
    const fields: UpworkProfileFields = {};

    if (input.currentTitle != null) fields.currentTitle = input.currentTitle;
    if (input.currentOverview != null) fields.currentOverview = input.currentOverview;
    if (input.currentHourlyRate != null) fields.currentHourlyRate = input.currentHourlyRate;
    if (input.currentPortfolio != null) {
      fields.currentPortfolio = JSON.stringify(input.currentPortfolio);
    }
    if (input.suggestedTitle != null) fields.suggestedTitle = input.suggestedTitle;
    if (input.suggestedOverview != null) fields.suggestedOverview = input.suggestedOverview;
    if (input.suggestedHourlyRate != null) {
      fields.suggestedHourlyRate = input.suggestedHourlyRate;
    }
    if (input.suggestedPortfolio != null) {
      fields.suggestedPortfolio = JSON.stringify(input.suggestedPortfolio);
    }
    if (input.status != null) {
      fields.status = input.status;
      fields.appliedAt = input.status === "applied" ? new Date() : null;
    }

    const row = await this.prisma.upworkProfile.upsert({
      where: { profileId },
      create: { profileId, ...fields },
      update: fields,
    });

    return toUpworkProfileDto(row);
  }

  // ── Proposals ──────────────────────────────────────────────────────────────
  async listProposals(profileId: number, filters: { status?: string; search?: string }) {
    const { status, search } = filters;

    const where: Prisma.UpworkProposalWhereInput = { profileId };
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [{ jobTitle: { contains: search } }, { clientName: { contains: search } }];
    }

    const proposals = await this.prisma.upworkProposal.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 500,
    });

    return proposals.map(decodeUpworkProposal);
  }

  async createProposal(profileId: number, body: UpworkProposalInput) {
    const proposal = await this.prisma.upworkProposal.create({
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

    return decodeUpworkProposal(proposal);
  }

  async getProposal(profileId: number, id: number) {
    const proposal = await findOwned(
      (where) => this.prisma.upworkProposal.findFirst({ where }),
      { id, profileId },
      "Proposal",
    );

    return decodeUpworkProposal(proposal);
  }

  async updateProposal(profileId: number, id: number, body: UpworkProposalPatch) {
    const existing = await findOwned(
      (where) => this.prisma.upworkProposal.findFirst({ where }),
      { id, profileId },
      "Proposal",
    );

    const update: Prisma.UpworkProposalUpdateInput = {
      jobTitle: body.jobTitle,
      clientName: body.clientName,
      jobUrl: body.jobUrl,
      jobDescription: body.jobDescription,
      proposalText: body.proposalText,
      status: body.status,
      outcome: body.outcome,
      notes: body.notes,
    };

    if (body.screeningAnswers !== undefined) {
      update.screeningAnswers = JSON.stringify(body.screeningAnswers);
    }

    if (body.submittedAt !== undefined) {
      update.submittedAt = body.submittedAt ? new Date(body.submittedAt) : null;
    } else if (body.status === "submitted" && !existing.submittedAt) {
      update.submittedAt = new Date();
    }

    const proposal = await this.prisma.upworkProposal.update({ where: { id }, data: update });

    return decodeUpworkProposal(proposal);
  }

  async deleteProposal(profileId: number, id: number) {
    await findOwned(
      (where) => this.prisma.upworkProposal.findFirst({ where, select: { id: true } }),
      { id, profileId },
      "Proposal",
    );

    await this.prisma.upworkProposal.delete({ where: { id } });

    return { id };
  }
}

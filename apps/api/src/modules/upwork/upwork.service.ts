import { type PaginationQuery, pageSlice, paginate } from "@jobpilot/contracts/pagination";
import type {
  PatchUpworkInboxItemInput,
  SyncUpworkInboxInput,
  UpdateUpworkAccountInput,
  UpdateUpworkProfileInput,
  UpworkClient,
  UpworkInboxKind,
  UpworkInboxStatus,
  UpworkProposalInput,
  UpworkProposalPatch,
  UpworkQualityResult,
} from "@jobpilot/contracts/upwork";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { decodeUpworkProposal, toUpworkInboxItemDto, toUpworkProfileDto } from "./upwork.mapper";
import { scoreUpworkClient } from "./upwork-quality";

/** Plain column writes - shared by upsert's create and update (no Prisma field-op wrappers). */
interface UpworkProfileFields {
  currentTitle?: string | null;
  currentOverview?: string | null;
  currentHourlyRate?: string | null;
  currentPortfolio?: string;
  currentSkills?: string;
  suggestedTitle?: string | null;
  suggestedOverview?: string | null;
  suggestedHourlyRate?: string | null;
  suggestedPortfolio?: string;
  suggestedSkills?: string;
  status?: string;
  appliedAt?: Date | null;
}

const ACCOUNT_SELECT = {
  id: true,
  connectsBalance: true,
  lastSyncedAt: true,
  updatedAt: true,
} as const;

@singleton()
export class UpworkService {
  constructor(private readonly prisma: PrismaClient) {}

  scoreClientQuality(client: UpworkClient): UpworkQualityResult {
    return scoreUpworkClient(client);
  }

  async getProfile(userId: string) {
    const row = await this.prisma.upworkProfile.findUnique({ where: { userId } });
    return row ? toUpworkProfileDto(row) : null;
  }

  /** Writes only the fields provided; moving to `applied` stamps `appliedAt`. */
  async upsertProfile(userId: string, input: UpdateUpworkProfileInput) {
    const fields: UpworkProfileFields = {};

    if (input.currentTitle != null) fields.currentTitle = input.currentTitle;
    if (input.currentOverview != null) fields.currentOverview = input.currentOverview;
    if (input.currentHourlyRate != null) fields.currentHourlyRate = input.currentHourlyRate;
    if (input.currentPortfolio != null) {
      fields.currentPortfolio = JSON.stringify(input.currentPortfolio);
    }
    if (input.currentSkills != null) fields.currentSkills = JSON.stringify(input.currentSkills);
    if (input.suggestedTitle != null) fields.suggestedTitle = input.suggestedTitle;
    if (input.suggestedOverview != null) fields.suggestedOverview = input.suggestedOverview;
    if (input.suggestedHourlyRate != null) {
      fields.suggestedHourlyRate = input.suggestedHourlyRate;
    }
    if (input.suggestedPortfolio != null) {
      fields.suggestedPortfolio = JSON.stringify(input.suggestedPortfolio);
    }
    if (input.suggestedSkills != null) {
      fields.suggestedSkills = JSON.stringify(input.suggestedSkills);
    }
    if (input.status != null) {
      fields.status = input.status;
      fields.appliedAt = input.status === "applied" ? new Date() : null;
    }

    const row = await this.prisma.upworkProfile.upsert({
      where: { userId },
      create: { userId, ...fields },
      update: fields,
    });

    return toUpworkProfileDto(row);
  }

  async getAccount(userId: string) {
    return this.prisma.upworkAccount.findUnique({
      where: { userId },
      select: ACCOUNT_SELECT,
    });
  }

  /** Any write is a sync, so it stamps `lastSyncedAt`. */
  async upsertAccount(userId: string, input: UpdateUpworkAccountInput) {
    const fields = { connectsBalance: input.connectsBalance ?? null, lastSyncedAt: new Date() };
    return this.prisma.upworkAccount.upsert({
      where: { userId },
      create: { userId, ...fields },
      update: fields,
      select: ACCOUNT_SELECT,
    });
  }

  async listInbox(
    userId: string,
    query: PaginationQuery & { kind?: UpworkInboxKind; status?: UpworkInboxStatus },
  ) {
    const where: Prisma.UpworkInboxItemWhereInput = { userId };
    if (query.kind) {
      where.kind = query.kind;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.upworkInboxItem.findMany({
        where,
        omit: { raw: true },
        orderBy: { receivedAt: "desc" },
        ...pageSlice(query),
      }),
      this.prisma.upworkInboxItem.count({ where }),
    ]);

    return paginate(items.map(toUpworkInboxItemDto), query, total);
  }

  /**
   * Keyed on Upwork's own id, so a repeated sync refreshes rather than duplicates.
   * `status` is never written on update: the user's read/archived choice outlives it.
   */
  async syncInbox(userId: string, input: SyncUpworkInboxInput) {
    const upworkIds = input.items.map((item) => item.upworkId);
    const existing = await this.prisma.upworkInboxItem.findMany({
      where: { userId, upworkId: { in: upworkIds } },
      select: { upworkId: true },
    });
    const known = new Set(existing.map((row) => row.upworkId));

    await this.prisma.$transaction(
      input.items.map((item) => {
        const fields = {
          kind: item.kind,
          title: item.title,
          clientName: item.clientName ?? null,
          jobUrl: item.jobUrl ?? null,
          body: item.body ?? null,
          receivedAt: new Date(item.receivedAt),
          raw: JSON.stringify(item.raw ?? {}),
        };
        return this.prisma.upworkInboxItem.upsert({
          where: { userId_upworkId: { userId, upworkId: item.upworkId } },
          create: { userId, upworkId: item.upworkId, ...fields },
          update: fields,
        });
      }),
    );

    return { created: upworkIds.length - known.size, updated: known.size };
  }

  async updateInboxItem(userId: string, id: string, input: PatchUpworkInboxItemInput) {
    await findOwned(
      (where) => this.prisma.upworkInboxItem.findFirst({ where }),
      { id, userId },
      "Inbox item",
    );
    const row = await this.prisma.upworkInboxItem.update({
      where: { id },
      data: { status: input.status },
    });
    return toUpworkInboxItemDto(row);
  }

  async listProposals(
    userId: string,
    query: PaginationQuery & { status?: string; search?: string },
  ) {
    const { status, search } = query;

    const where: Prisma.UpworkProposalWhereInput = { userId };
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { jobTitle: { contains: search, mode: "insensitive" } },
        { clientName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [proposals, total] = await Promise.all([
      this.prisma.upworkProposal.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        ...pageSlice(query),
      }),
      this.prisma.upworkProposal.count({ where }),
    ]);

    return paginate(proposals.map(decodeUpworkProposal), query, total);
  }

  async createProposal(userId: string, body: UpworkProposalInput) {
    const proposal = await this.prisma.upworkProposal.create({
      data: {
        userId,
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

  async getProposal(userId: string, id: string) {
    const proposal = await findOwned(
      (where) => this.prisma.upworkProposal.findFirst({ where }),
      { id, userId },
      "Proposal",
    );

    return decodeUpworkProposal(proposal);
  }

  async updateProposal(userId: string, id: string, body: UpworkProposalPatch) {
    const existing = await findOwned(
      (where) => this.prisma.upworkProposal.findFirst({ where }),
      { id, userId },
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

  async deleteProposal(userId: string, id: string) {
    await findOwned(
      (where) => this.prisma.upworkProposal.findFirst({ where, select: { id: true } }),
      { id, userId },
      "Proposal",
    );

    await this.prisma.upworkProposal.delete({ where: { id } });

    return { id };
  }
}

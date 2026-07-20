import type { ReleasePilotLeaseInput } from "@jobpilot/contracts/pilot";
import { singleton } from "tsyringe";
import { conflict, findOwned } from "@/common/errors";
import { type PilotLease, PrismaClient } from "@/generated/prisma/client";
import { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { toPilotLease } from "../pilot.mapper";
import { jobRef, parsePayload, revertJobToApproved } from "./expiry";
import { verifyGrant } from "./grant";
import { AgendaService } from "./service";

const LEASE_TTL_MS = 15 * 60 * 1000;

/**
 * The agenda's claim lifecycle: grant a lease over one compiled item, keep it alive, release it.
 * Split from AgendaService because compiling an agenda and owning a claim share no state beyond
 * Prisma - leasing only calls back into the compile to re-derive the item it is asked for.
 */
@singleton()
export class LeaseService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly campaignJobs: CampaignJobService,
    private readonly agenda: AgendaService,
  ) {}

  private get jobDeps() {
    return { prisma: this.prisma, campaignJobs: this.campaignJobs };
  }

  async lease(userId: string, itemId: string) {
    const agenda = await this.agenda.compile(userId);
    const item = agenda.items.find((i) => i.id === itemId);
    if (!item) {
      throw conflict("Agenda item is no longer available.");
    }

    // One active lease per subject: refuses a second worker taking the same item (409).
    const active = await this.prisma.pilotLease.findFirst({
      where: {
        userId,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        releasedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (active) {
      throw conflict("This item is already leased.");
    }

    // Server-side grant gates: re-verify the row is still in a leasable state, ignoring agent claims.
    await verifyGrant(this.prisma, userId, item.kind, item.subjectId);

    const { campaignId, jobKey } = item.payload as { campaignId?: string; jobKey?: string };
    // Single-writer claim first: only one lease can flip approved->applying (409 on a lost race).
    const jobClaim =
      item.kind === "job.apply" && campaignId && jobKey ? { campaignId, jobKey } : null;
    if (jobClaim) {
      await this.campaignJobs.claimJobForApply(userId, jobClaim.campaignId, jobClaim.jobKey);
    }

    let lease: PilotLease;
    try {
      lease = await this.prisma.pilotLease.create({
        data: {
          userId,
          kind: item.kind,
          subjectType: item.subjectType,
          subjectId: item.subjectId,
          payload: JSON.stringify(item.payload),
          expiresAt: new Date(Date.now() + LEASE_TTL_MS),
        },
      });
    } catch (err) {
      // A claim without a lease row would strand the job in applying; hand it back to the agenda.
      if (jobClaim) {
        await revertJobToApproved(this.jobDeps, userId, jobClaim.campaignId, jobClaim.jobKey);
      }
      throw err;
    }

    return { ...toPilotLease(lease), payload: item.payload };
  }

  async heartbeat(userId: string, id: string) {
    const existing = await findOwned(
      (where) =>
        this.prisma.pilotLease.findFirst({ where, select: { id: true, releasedAt: true } }),
      { id, userId },
      "Lease",
    );
    // A released lease must not get its TTL resurrected by a late worker heartbeat.
    if (existing.releasedAt) throw conflict("Lease is already released.");
    const lease = await this.prisma.pilotLease.update({
      where: { id },
      data: { heartbeatAt: new Date(), expiresAt: new Date(Date.now() + LEASE_TTL_MS) },
    });
    return toPilotLease(lease);
  }

  async release(userId: string, id: string, body: ReleasePilotLeaseInput) {
    const existing = await findOwned(
      (where) => this.prisma.pilotLease.findFirst({ where }),
      { id, userId },
      "Lease",
    );
    // A released lease is terminal; a second release must not overwrite its recorded outcome.
    if (existing.releasedAt) throw conflict("Lease is already released.");

    const parsed = parsePayload(existing.payload);
    const { campaignId, jobKey } = jobRef(parsed, existing.subjectId);
    // "abandoned" un-claims the work; the terminal result for done/failed arrives via the campaign result route.
    if (body.outcome === "abandoned" && existing.kind === "job.apply" && campaignId) {
      await revertJobToApproved(this.jobDeps, userId, campaignId, jobKey);
    }

    const payload = body.note
      ? JSON.stringify({ ...parsed, releaseNote: body.note })
      : existing.payload;

    const lease = await this.prisma.pilotLease.update({
      where: { id },
      data: { releasedAt: new Date(), outcome: body.outcome, payload },
    });
    return toPilotLease(lease);
  }
}

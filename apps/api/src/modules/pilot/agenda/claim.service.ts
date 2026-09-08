import { type AgendaItem, type ReleasePilotClaimInput } from "@jobpilot/contracts/pilot";
import { singleton } from "tsyringe";
import { z } from "zod/v4";
import { conflict, findOwned } from "@/common/errors";
import { toInputJson } from "@/common/json";
import { type Job, type PilotClaim, type Prisma, PrismaClient } from "@/generated/prisma/client";
import { AlreadyAppliedError } from "@/modules/campaign/jobs/applied-guard";
import { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { toPilotClaim } from "../pilot.mapper";
import { MAX_CLAIM_LIFETIME_MS } from "./constants";
import { verifyGrant } from "./grant";
import { parseJobPayload } from "./job-mutations";
import { parseAgendaSnapshot } from "./service";

const CLAIM_TTL_MS = 15 * 60 * 1000;

/**
 * Holds a heartbeat-extended expiry to a fixed ceiling from when the claim was granted, so a
 * stuck-but-beating driver still expires no matter which kind of work it is running.
 */
function lifetimeCap(claim: { grantedAt: Date } | null, proposedExpiry: number): number {
  if (!claim) {
    return proposedExpiry;
  }
  return Math.min(proposedExpiry, claim.grantedAt.getTime() + MAX_CLAIM_LIFETIME_MS);
}

/** Either the claim, or the duplicate refusal the guard recorded a skip for. */
type ClaimResult =
  | { claim: PilotClaim; item: AgendaItem; claimedJob: Job | null }
  | AlreadyAppliedError;

/** Atomically claims versioned agenda items and manages claim heartbeats and release. */
@singleton()
export class ClaimService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly campaignJobs: CampaignJobService,
  ) {}

  async claim(userId: string, agendaVersion: string, itemId: string) {
    const result = await this.prisma.$transaction((tx) =>
      this.claimInTransaction(tx, userId, agendaVersion, itemId),
    );

    // Committing is the point: the guard recorded the skip inside that same transaction.
    if (result instanceof AlreadyAppliedError)
      return this.campaignJobs.rejectDuplicate(userId, result);

    if (result.claimedJob && result.item.kind === "job.apply") {
      this.campaignJobs.publishClaimedJob(
        userId,
        result.item.payload.campaignId,
        result.claimedJob,
      );
    }
    return toPilotClaim(result.claim);
  }

  private async claimInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    agendaVersion: string,
    itemId: string,
  ): Promise<ClaimResult> {
    const now = new Date();
    const locked = await tx.pilotState.updateMany({
      where: {
        userId,
        running: true,
        agendaVersion,
        agendaExpiresAt: { gt: now },
      },
      data: { agendaVersion },
    });

    if (locked.count === 0) {
      const current = await tx.pilotState.findUnique({
        where: { userId },
        select: { running: true },
      });
      if (!current?.running) throw conflict("Pilot is stopped.");
      throw conflict("Agenda snapshot is stale; refresh it before claiming.");
    }

    const state = await tx.pilotState.findUniqueOrThrow({ where: { userId } });
    if (!state.agendaSnapshot) {
      throw conflict("Agenda snapshot is stale; refresh it before claiming.");
    }
    const item = parseAgendaSnapshot(state.agendaSnapshot).items.find(
      (candidate) => candidate.id === itemId,
    );
    if (!item) throw conflict("Agenda item is no longer available.");

    // Safe as a read-then-write: the pilotState update above locks this user's row for the
    // rest of the transaction, so concurrent claim() calls for one user serialize here.
    const open = await tx.pilotClaim.findFirst({
      where: {
        userId,
        kind: item.kind,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        releasedAt: null,
      },
      select: { id: true },
    });
    if (open) throw conflict("This item is already claimed.");

    await verifyGrant(tx, userId, item.kind, item.subjectId);
    let claimedJob = null;
    if (item.kind === "job.apply") {
      const attempt = await this.campaignJobs.claimJobForApplyInTransaction(
        tx,
        userId,
        item.payload.campaignId,
        item.payload.jobKey,
      );
      if (attempt instanceof AlreadyAppliedError) return attempt;
      claimedJob = attempt;
    }

    const claim = await tx.pilotClaim.create({
      data: {
        userId,
        kind: item.kind,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        payload: toInputJson(item.payload),
        expiresAt: new Date(now.getTime() + CLAIM_TTL_MS),
      },
    });
    return { claim, item, claimedJob };
  }

  async heartbeat(userId: string, id: string) {
    const open = await this.prisma.pilotClaim.findFirst({
      where: { id, userId, releasedAt: null },
      select: { grantedAt: true },
    });

    const now = Date.now();
    const updated = await this.prisma.pilotClaim.updateMany({
      where: { id, userId, releasedAt: null },
      data: {
        heartbeatAt: new Date(now),
        expiresAt: new Date(lifetimeCap(open, now + CLAIM_TTL_MS)),
      },
    });
    if (updated.count === 0) {
      const existing = await this.prisma.pilotClaim.findFirst({ where: { id, userId } });
      if (!existing) await findOwned(() => Promise.resolve(null), { id, userId }, "Claim");
      throw conflict("Claim is already released.");
    }
    return toPilotClaim(await this.prisma.pilotClaim.findUniqueOrThrow({ where: { id } }));
  }

  async release(userId: string, id: string, body: ReleasePilotClaimInput) {
    const existing = await findOwned(
      (where) => this.prisma.pilotClaim.findFirst({ where }),
      { id, userId },
      "Claim",
    );
    if (existing.releasedAt) {
      if (existing.outcome === body.outcome) return toPilotClaim(existing);
      throw conflict(`Claim already released with outcome ${existing.outcome}.`);
    }

    const payload = z.record(z.string(), z.json()).parse(existing.payload);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (body.outcome === "abandoned" && existing.kind === "job.apply") {
        const jobRef = parseJobPayload(payload);
        await tx.job.updateMany({
          where: {
            campaignId: jobRef.campaignId,
            key: jobRef.jobKey,
            status: "applying",
            campaign: { userId },
          },
          data: { status: "approved" },
        });
      }

      const changed = await tx.pilotClaim.updateMany({
        where: { id, userId, releasedAt: null },
        data: {
          releasedAt: new Date(),
          outcome: body.outcome,
          payload: toInputJson(body.note ? { ...payload, releaseNote: body.note } : payload),
        },
      });
      if (changed.count === 0) throw conflict("Claim was released concurrently.");
      return tx.pilotClaim.findUniqueOrThrow({ where: { id } });
    });
    return toPilotClaim(updated);
  }
}

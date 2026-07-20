import { type ReleasePilotLeaseInput } from "@jobpilot/contracts/pilot";
import { singleton } from "tsyringe";
import { z } from "zod/v4";
import { conflict, findOwned, isPrismaError, PRISMA_ERRORS } from "@/common/errors";
import { toInputJson } from "@/common/json";
import { PrismaClient } from "@/generated/prisma/client";
import { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { toPilotLease } from "../pilot.mapper";
import { verifyGrant } from "./grant";
import { parseJobPayload } from "./job-mutations";
import { parseAgendaSnapshot } from "./service";

const LEASE_TTL_MS = 15 * 60 * 1000;

/** Atomically claims versioned agenda items and manages lease heartbeats and release. */
@singleton()
export class LeaseService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly campaignJobs: CampaignJobService,
  ) {}

  async lease(userId: string, agendaVersion: string, itemId: string) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const locked = await tx.pilotState.updateMany({
          where: {
            userId,
            enabled: true,
            agendaVersion,
            agendaExpiresAt: { gt: now },
          },
          data: { agendaVersion },
        });
        if (locked.count === 0) {
          const current = await tx.pilotState.findUnique({
            where: { userId },
            select: { enabled: true },
          });
          if (!current?.enabled) throw conflict("Pilot is disabled.");
          throw conflict("Agenda snapshot is stale; refresh it before leasing.");
        }
        const state = await tx.pilotState.findUniqueOrThrow({ where: { userId } });
        if (!state.agendaSnapshot) {
          throw conflict("Agenda snapshot is stale; refresh it before leasing.");
        }
        const item = parseAgendaSnapshot(state.agendaSnapshot).items.find(
          (candidate) => candidate.id === itemId,
        );
        if (!item) throw conflict("Agenda item is no longer available.");

        await verifyGrant(tx, userId, item.kind, item.subjectId);
        let claimedJob = null;
        if (item.kind === "job.apply") {
          claimedJob = await this.campaignJobs.claimJobForApplyInTransaction(
            tx,
            userId,
            item.payload.campaignId,
            item.payload.jobKey,
          );
        }
        const lease = await tx.pilotLease.create({
          data: {
            userId,
            kind: item.kind,
            subjectType: item.subjectType,
            subjectId: item.subjectId,
            payload: toInputJson(item.payload),
            expiresAt: new Date(now.getTime() + LEASE_TTL_MS),
          },
        });
        return { lease, item, claimedJob };
      });
      if (result.claimedJob && result.item.kind === "job.apply") {
        this.campaignJobs.publishClaimedJob(
          userId,
          result.item.payload.campaignId,
          result.claimedJob,
        );
      }
      return toPilotLease(result.lease);
    } catch (error) {
      if (isPrismaError(error, PRISMA_ERRORS.UNIQUE_VIOLATION)) {
        throw conflict("This item is already leased.");
      }
      throw error;
    }
  }

  async heartbeat(userId: string, id: string) {
    const updated = await this.prisma.pilotLease.updateMany({
      where: { id, userId, releasedAt: null },
      data: { heartbeatAt: new Date(), expiresAt: new Date(Date.now() + LEASE_TTL_MS) },
    });
    if (updated.count === 0) {
      const existing = await this.prisma.pilotLease.findFirst({ where: { id, userId } });
      if (!existing) await findOwned(() => Promise.resolve(null), { id, userId }, "Lease");
      throw conflict("Lease is already released.");
    }
    return toPilotLease(await this.prisma.pilotLease.findUniqueOrThrow({ where: { id } }));
  }

  async release(userId: string, id: string, body: ReleasePilotLeaseInput) {
    const existing = await findOwned(
      (where) => this.prisma.pilotLease.findFirst({ where }),
      { id, userId },
      "Lease",
    );
    if (existing.releasedAt) {
      if (existing.outcome === body.outcome) return toPilotLease(existing);
      throw conflict(`Lease already released with outcome ${existing.outcome}.`);
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
      const changed = await tx.pilotLease.updateMany({
        where: { id, userId, releasedAt: null },
        data: {
          releasedAt: new Date(),
          outcome: body.outcome,
          payload: toInputJson(body.note ? { ...payload, releaseNote: body.note } : payload),
        },
      });
      if (changed.count === 0) throw conflict("Lease was released concurrently.");
      return tx.pilotLease.findUniqueOrThrow({ where: { id } });
    });
    return toPilotLease(updated);
  }
}

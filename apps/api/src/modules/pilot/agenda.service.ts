import {
  type PilotMandateConfig,
  pilotMandateConfigSchema,
  type ReleasePilotLeaseInput,
} from "@jobpilot/contracts/pilot";
import { singleton } from "tsyringe";
import { conflict, findOwned } from "@/common/errors";
import { type PilotLease, PrismaClient } from "@/generated/prisma/client";
import { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { buildAgenda } from "./agenda/build";
import { writeDigestIfDue } from "./agenda.digest";
import { jobRef, parsePayload, revertJobToApproved, runExpiry } from "./agenda.expiry";
import {
  attachWarmContacts,
  dueStandingQueries,
  gatherAnsweredEscalations,
  gatherApprovedJobs,
  gatherFinalizeCampaigns,
  gatherInbox,
} from "./agenda.gather";
import {
  dueVenues,
  gatherApprovedOutreach,
  gatherApprovedPromotions,
  gatherFollowups,
} from "./agenda.gather.outreach";
import { verifyGrant } from "./agenda.grant";
import { toPilotLease } from "./pilot.mapper";
import { PilotService } from "./pilot.service";
import { countAppliedToday, countSentToday } from "./pilot.stats";
import { PushService } from "./push.service";

const LEASE_TTL_MS = 15 * 60 * 1000;

@singleton()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly campaignJobs: CampaignJobService,
    private readonly pilot: PilotService,
    private readonly push: PushService,
  ) {}

  private get jobDeps() {
    return { prisma: this.prisma, campaignJobs: this.campaignJobs };
  }

  private async loadConfig(profileId: string): Promise<PilotMandateConfig> {
    const state = await this.prisma.pilotState.upsert({
      where: { profileId },
      create: { profileId },
      update: {},
    });
    return pilotMandateConfigSchema.parse(JSON.parse(state.mandateConfig));
  }

  async compile(profileId: string) {
    const now = new Date();
    // Config and the expiry sweep are independent; both must settle before the main batch.
    const [config] = await Promise.all([
      this.loadConfig(profileId),
      runExpiry(this.jobDeps, profileId, now),
    ]);

    const tz = config.activeHours?.tz;
    const [
      openEscalations,
      answeredEscalations,
      activeLeases,
      approvedJobs,
      appliedToday,
      finalizeCampaigns,
      inbox,
      approvedOutreach,
      outreachSentToday,
      followups,
      approvedPromotions,
      dueVenueList,
    ] = await Promise.all([
      this.prisma.escalation.count({ where: { profileId, status: "open" } }),
      gatherAnsweredEscalations(this.prisma, profileId),
      this.prisma.pilotLease.count({
        where: { profileId, releasedAt: null, expiresAt: { gt: now } },
      }),
      gatherApprovedJobs(this.prisma, profileId),
      countAppliedToday(this.prisma, profileId, now, tz),
      gatherFinalizeCampaigns(this.prisma, profileId),
      gatherInbox(this.prisma, profileId),
      gatherApprovedOutreach(this.prisma, profileId),
      countSentToday(this.prisma, profileId, now, tz),
      gatherFollowups(this.prisma, profileId, config, now),
      gatherApprovedPromotions(this.prisma, profileId, now),
      dueVenues(this.prisma, profileId, config, now),
    ]);

    // Warm-check join: attach same-company contacts to high-score jobs so the builder can offer a warm intro.
    await attachWarmContacts(this.prisma, profileId, approvedJobs);

    // Discovery only matters when the apply pipeline is empty; skip the lease lookups otherwise.
    const dueQueries =
      approvedJobs.length === 0
        ? await dueStandingQueries(this.prisma, profileId, config, now)
        : [];

    // Idempotent per tz-day; fire-and-forget so a slow push never delays the agenda response.
    void writeDigestIfDue(
      { prisma: this.prisma, pilot: this.pilot, push: this.push },
      profileId,
      now,
      config,
      openEscalations,
    );

    return buildAgenda({
      now,
      config,
      openEscalations,
      answeredEscalations,
      activeLeases,
      approvedJobs,
      appliedToday,
      dueQueries,
      finalizeCampaigns,
      inbox,
      approvedOutreach,
      outreachSentToday,
      followups,
      dueVenues: dueVenueList,
      approvedPromotions,
    });
  }

  // ── Leasing ──────────────────────────────────────────────────────────────────

  async lease(profileId: string, itemId: string) {
    const agenda = await this.compile(profileId);
    const item = agenda.items.find((i) => i.id === itemId);
    if (!item) {
      throw conflict("Agenda item is no longer available.");
    }

    // One active lease per subject: refuses a second worker taking the same item (409).
    const active = await this.prisma.pilotLease.findFirst({
      where: {
        profileId,
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
    await verifyGrant(this.prisma, profileId, item.kind, item.subjectId);

    const jobPayload = item.payload as { campaignId?: string; jobKey?: string };
    const isJobClaim = item.kind === "job.apply" && !!jobPayload.campaignId && !!jobPayload.jobKey;

    // Single-writer claim first: only one lease can flip approved->applying (409 on a lost race).
    if (isJobClaim) {
      await this.campaignJobs.claimJobForApply(
        profileId,
        jobPayload.campaignId!,
        jobPayload.jobKey!,
      );
    }

    let lease: PilotLease;
    try {
      lease = await this.prisma.pilotLease.create({
        data: {
          profileId,
          kind: item.kind,
          subjectType: item.subjectType,
          subjectId: item.subjectId,
          payload: JSON.stringify(item.payload),
          expiresAt: new Date(Date.now() + LEASE_TTL_MS),
        },
      });
    } catch (err) {
      // A claim without a lease row would strand the job in applying; hand it back to the agenda.
      if (isJobClaim) {
        await revertJobToApproved(
          this.jobDeps,
          profileId,
          jobPayload.campaignId!,
          jobPayload.jobKey!,
        );
      }
      throw err;
    }

    return { ...toPilotLease(lease), payload: item.payload };
  }

  async heartbeat(profileId: string, id: string) {
    await findOwned(
      (where) => this.prisma.pilotLease.findFirst({ where, select: { id: true } }),
      { id, profileId },
      "Lease",
    );
    const lease = await this.prisma.pilotLease.update({
      where: { id },
      data: { heartbeatAt: new Date(), expiresAt: new Date(Date.now() + LEASE_TTL_MS) },
    });
    return toPilotLease(lease);
  }

  async release(profileId: string, id: string, body: ReleasePilotLeaseInput) {
    const existing = await findOwned(
      (where) => this.prisma.pilotLease.findFirst({ where }),
      { id, profileId },
      "Lease",
    );

    const parsed = parsePayload(existing.payload);
    const { campaignId, jobKey } = jobRef(parsed, existing.subjectId);
    // "abandoned" un-claims the work; the terminal result for done/failed arrives via the campaign result route.
    if (body.outcome === "abandoned" && existing.kind === "job.apply" && campaignId) {
      await revertJobToApproved(this.jobDeps, profileId, campaignId, jobKey);
    }

    const payload = body.note
      ? JSON.stringify({ ...parsed, releaseNote: body.note })
      : existing.payload;

    const lease = await this.prisma.pilotLease.update({
      where: { id },
      data: { releasedAt: existing.releasedAt ?? new Date(), outcome: body.outcome, payload },
    });
    return toPilotLease(lease);
  }
}

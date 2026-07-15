import { CAMPAIGN_JOB_ACTIVE_STATUSES, type CampaignConfig } from "@jobpilot/contracts/campaign";
import {
  type PilotMandateConfig,
  pilotMandateConfigSchema,
  type ReleasePilotLeaseInput,
} from "@jobpilot/contracts/pilot";
import { singleton } from "tsyringe";
import { conflict, findOwned } from "@/common/errors";
import { type PilotLease, PrismaClient } from "@/generated/prisma/client";
import { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { type AgendaApprovedJob, type AgendaDueQuery, buildAgenda } from "./agenda.build";
import { toPilotLease } from "./pilot.mapper";
import { startOfDayInTz } from "./pilot.time";

const LEASE_TTL_MS = 15 * 60 * 1000;

@singleton()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly campaignJobs: CampaignJobService,
  ) {}

  private async loadConfig(profileId: string): Promise<PilotMandateConfig> {
    const state = await this.prisma.pilotState.upsert({
      where: { profileId },
      create: { profileId },
      update: {},
    });
    return pilotMandateConfigSchema.parse(JSON.parse(state.mandateConfig));
  }

  // ── Lazy expiry ────────────────────────────────────────────────────────────────

  /**
   * Sweep overdue leases and escalations before compiling. An expired job lease
   * reverts its job to `approved`; an expired escalation whose job is parked in
   * `needs_user` is skipped through the campaign job service. The two passes are
   * independent, so they run in parallel. Runs first so the agenda reflects the cleanup.
   */
  private async runExpiry(profileId: string, now: Date): Promise<void> {
    await Promise.all([this.expireLeases(profileId, now), this.expireEscalations(profileId, now)]);
  }

  private async expireLeases(profileId: string, now: Date): Promise<void> {
    const leases = await this.prisma.pilotLease.findMany({
      where: { profileId, releasedAt: null, expiresAt: { lt: now } },
    });
    if (leases.length === 0) {
      return;
    }
    await this.prisma.pilotLease.updateMany({
      where: { id: { in: leases.map((l) => l.id) } },
      data: { releasedAt: now, outcome: "expired" },
    });
    const reverts = leases
      .filter((l) => l.kind === "job.apply")
      .map((l) => this.jobRef(l.payload, l.subjectId))
      .filter((ref) => ref.campaignId)
      .map((ref) => this.revertJobToApproved(profileId, ref.campaignId, ref.jobKey));
    await Promise.all(reverts);
  }

  private async expireEscalations(profileId: string, now: Date): Promise<void> {
    const escalations = await this.prisma.escalation.findMany({
      where: { profileId, status: "open", expiresAt: { not: null, lt: now } },
    });
    if (escalations.length === 0) {
      return;
    }
    await this.prisma.escalation.updateMany({
      where: { id: { in: escalations.map((e) => e.id) } },
      data: { status: "expired" },
    });
    const skips = escalations
      .filter((e) => e.subjectType === "job" && e.subjectId)
      .map((e) => this.skipParkedJob(profileId, e.subjectId as string));
    await Promise.all(skips);
  }

  /** Job escalation subjects are stored as `${campaignId}:${jobKey}`. */
  private splitJobSubject(subjectId: string): { campaignId: string; jobKey: string } {
    const idx = subjectId.indexOf(":");
    return idx === -1
      ? { campaignId: subjectId, jobKey: "" }
      : { campaignId: subjectId.slice(0, idx), jobKey: subjectId.slice(idx + 1) };
  }

  private jobRef(payload: string, subjectId: string): { campaignId: string; jobKey: string } {
    const p = JSON.parse(payload) as { campaignId?: string; jobKey?: string };
    return { campaignId: p.campaignId ?? "", jobKey: p.jobKey ?? subjectId };
  }

  private async revertJobToApproved(profileId: string, campaignId: string, jobKey: string) {
    const job = await this.prisma.job.findFirst({
      where: { campaignId, key: jobKey, campaign: { profileId } },
      select: { status: true },
    });
    if (job?.status === "applying") {
      await this.campaignJobs.patchJob(profileId, campaignId, jobKey, { status: "approved" });
    }
  }

  private async skipParkedJob(profileId: string, subjectId: string) {
    const { campaignId, jobKey } = this.splitJobSubject(subjectId);
    if (!campaignId || !jobKey) {
      return;
    }
    const job = await this.prisma.job.findFirst({
      where: { campaignId, key: jobKey, campaign: { profileId } },
      select: { status: true },
    });
    if (job?.status === "needs_user") {
      await this.campaignJobs.recordJobResult(profileId, campaignId, jobKey, {
        outcome: "skipped",
        skipReason: "Escalation expired without an answer.",
      });
    }
  }

  // ── Compile ──────────────────────────────────────────────────────────────────

  async compile(profileId: string) {
    const now = new Date();
    // Config and the expiry sweep are independent; both must settle before the main batch.
    const [config] = await Promise.all([
      this.loadConfig(profileId),
      this.runExpiry(profileId, now),
    ]);

    const [
      openEscalations,
      answered,
      escalationLeases,
      activeLeases,
      approvedRows,
      appliedToday,
      finalizeRows,
    ] = await Promise.all([
      this.prisma.escalation.count({ where: { profileId, status: "open" } }),
      this.prisma.escalation.findMany({
        where: { profileId, status: "answered" },
        orderBy: { answeredAt: "asc" },
      }),
      this.prisma.pilotLease.findMany({
        where: { profileId, subjectType: "escalation" },
        select: { subjectId: true },
      }),
      this.prisma.pilotLease.count({
        where: { profileId, releasedAt: null, expiresAt: { gt: now } },
      }),
      this.prisma.job.findMany({
        where: { status: "approved", campaign: { profileId, status: "in_progress" } },
        orderBy: { matchScore: "desc" },
        include: { campaign: { select: { config: true } } },
      }),
      this.prisma.application.count({
        where: { profileId, appliedAt: { gte: startOfDayInTz(now, config.activeHours?.tz) } },
      }),
      this.prisma.campaign.findMany({
        where: {
          profileId,
          status: "in_progress",
          jobs: { none: { status: { in: [...CAMPAIGN_JOB_ACTIVE_STATUSES] } } },
        },
        select: { campaignId: true, query: true },
      }),
    ]);

    // Consumed once any lease references the escalation, so a claimed answer never re-appears.
    const consumed = new Set(escalationLeases.map((l) => l.subjectId));
    const answeredEscalations = answered
      .filter((e) => !consumed.has(e.id))
      .map((e) => ({ id: e.id, kind: e.kind, question: e.question }));

    // Jobs of the same campaign share one config; parse each campaign's JSON at most once.
    const configByCampaign = new Map<string, CampaignConfig>();
    const approvedJobs: AgendaApprovedJob[] = approvedRows.map((job) => {
      let cfg = configByCampaign.get(job.campaignId);
      if (!cfg) {
        cfg = JSON.parse(job.campaign.config) as CampaignConfig;
        configByCampaign.set(job.campaignId, cfg);
      }
      return {
        campaignId: job.campaignId,
        key: job.key,
        title: job.title,
        url: job.url,
        board: job.board,
        digest: job.digest,
        matchScore: job.matchScore,
        resumeId: cfg.resumeId,
      };
    });

    // Discovery only matters when the apply pipeline is empty; skip the lease lookups otherwise.
    const dueQueries =
      approvedJobs.length === 0 ? await this.dueStandingQueries(profileId, config, now) : [];

    return buildAgenda({
      now,
      config,
      openEscalations,
      answeredEscalations,
      activeLeases,
      approvedJobs,
      appliedToday,
      dueQueries,
      finalizeCampaigns: finalizeRows,
    });
  }

  private async dueStandingQueries(
    profileId: string,
    config: PilotMandateConfig,
    now: Date,
  ): Promise<AgendaDueQuery[]> {
    if (config.standingQueries.length === 0) {
      return [];
    }
    // One read for every discovery lease, reduced to the latest per query - avoids an N+1 findFirst.
    const leases = await this.prisma.pilotLease.findMany({
      where: { profileId, kind: "search.discover" },
      select: { subjectId: true, grantedAt: true, releasedAt: true },
    });
    const latest = new Map<string, { grantedAt: Date; releasedAt: Date | null }>();
    for (const l of leases) {
      const prev = latest.get(l.subjectId);
      if (!prev || l.grantedAt > prev.grantedAt) {
        latest.set(l.subjectId, { grantedAt: l.grantedAt, releasedAt: l.releasedAt });
      }
    }

    const due: AgendaDueQuery[] = [];
    for (const sq of config.standingQueries) {
      const last = latest.get(sq.query);
      const cadenceMs = sq.cadenceHours * 60 * 60 * 1000;
      // Due when never run, or the last run released longer ago than the cadence. An active
      // (unreleased) discovery lease means it is in progress, so it is not due.
      const isDue =
        !last ||
        (last.releasedAt != null && now.getTime() - last.releasedAt.getTime() >= cadenceMs);
      if (isDue) {
        due.push({ query: sq.query, board: sq.board, resumeId: sq.resumeId });
      }
    }
    return due;
  }

  // ── Leasing ──────────────────────────────────────────────────────────────────

  async lease(profileId: string, itemId: string) {
    const agenda = await this.compile(profileId);
    const item = agenda.items.find((i) => i.id === itemId);
    if (!item) {
      throw conflict("Agenda item is no longer available.");
    }

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
        await this.revertJobToApproved(profileId, jobPayload.campaignId!, jobPayload.jobKey!);
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

    const parsed = JSON.parse(existing.payload) as { campaignId?: string; jobKey?: string };
    const campaignId = parsed.campaignId ?? "";
    const jobKey = parsed.jobKey ?? existing.subjectId;
    // "abandoned" un-claims the work; the terminal result for done/failed arrives via the campaign result route.
    if (body.outcome === "abandoned" && existing.kind === "job.apply" && campaignId) {
      await this.revertJobToApproved(profileId, campaignId, jobKey);
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

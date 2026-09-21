// The scheduled job-alert harvest: when it is due, and how its item and wake-up land on the agenda.
import { buildAgenda } from "./build";
import { base, cfg, job } from "./builders";
import { jobAlertsDue } from "./candidates-job-alerts";
import { describe, expect, it } from "bun:test";

// Matches the builders' clock; in UTC the 08:00 slot has struck and 17:00 is ahead.
const NOW = new Date("2026-07-15T12:00:00.000Z");
const enabled = cfg({ jobAlerts: { enabled: true, runHours: [8, 17], timeZone: "UTC" } }).jobAlerts;
const at = (iso: string) => new Date(iso);
const claim = (grantedAt: string, outcome: "done" | "failed" | "expired" | null) => ({
  grantedAt: at(grantedAt),
  releasedAt: outcome ? at(grantedAt) : null,
  expiresAt: at("2026-07-15T12:10:00Z"),
  outcome,
});

describe("jobAlertsDue", () => {
  it("is never due while the harvest is off", () => {
    expect(jobAlertsDue(cfg().jobAlerts, null, null, NOW)).toBe(false);
  });

  it("is due on the first run", () => {
    expect(jobAlertsDue(enabled, null, null, NOW)).toBe(true);
  });

  it("runs once per slot: a success after 08:00 holds until 17:00", () => {
    expect(jobAlertsDue(enabled, claim("2026-07-15T08:05:00Z", "done"), null, NOW)).toBe(false);
    expect(jobAlertsDue(enabled, claim("2026-07-14T17:05:00Z", "done"), null, NOW)).toBe(true);
  });

  it("stays quiet while a harvest is in flight", () => {
    expect(jobAlertsDue(enabled, claim("2026-07-15T11:58:00Z", null), null, NOW)).toBe(false);
  });

  it("retries a failed harvest after the retry gap, not the next slot", () => {
    expect(jobAlertsDue(enabled, claim("2026-07-15T11:30:00Z", "failed"), null, NOW)).toBe(false);
    expect(jobAlertsDue(enabled, claim("2026-07-15T10:30:00Z", "expired"), null, NOW)).toBe(true);
  });
});

describe("jobAlertsDue with Run now", () => {
  const off = cfg().jobAlerts;

  it("fires a fresh request even with the schedule off", () => {
    expect(jobAlertsDue(off, null, at("2026-07-15T11:50:00Z"), NOW)).toBe(true);
  });

  it("is spent once a harvest was claimed after it", () => {
    const request = at("2026-07-15T11:50:00Z");
    expect(jobAlertsDue(off, claim("2026-07-15T11:52:00Z", "done"), request, NOW)).toBe(false);
  });

  it("fires even when this slot already ran", () => {
    const request = at("2026-07-15T11:50:00Z");
    expect(jobAlertsDue(enabled, claim("2026-07-15T08:05:00Z", "done"), request, NOW)).toBe(true);
  });

  it("lapses after an hour so a stopped pilot does not fire it later", () => {
    expect(jobAlertsDue(off, null, at("2026-07-15T10:30:00Z"), NOW)).toBe(false);
  });

  it("waits for an in-flight harvest", () => {
    const request = at("2026-07-15T11:50:00Z");
    expect(jobAlertsDue(off, claim("2026-07-15T11:40:00Z", null), request, NOW)).toBe(false);
  });
});

describe("buildAgenda inbox.jobAlerts", () => {
  const alerts = { messageIds: ["e1", "e2"], count: 2, senderDomains: ["linkedin.com"] };

  it("emits one harvest item carrying the pilot-wide threshold", () => {
    const agenda = buildAgenda(base({ config: cfg({ minScore: 72 }), jobAlerts: alerts }));
    const item = agenda.items.find((i) => i.kind === "inbox.jobAlerts");
    expect(item?.payload).toEqual({ ...alerts, minScore: 72 });
    expect(item?.subjectId).toBe("jobAlerts");
  });

  it("ranks below applies and still runs once the daily cap is spent", () => {
    const agenda = buildAgenda(
      base({ approvedJobs: [job("j1", 80)], jobAlerts: alerts, appliedToday: 0 }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual(["job.apply", "inbox.jobAlerts"]);

    const capped = buildAgenda(
      base({ config: cfg({ dailyApplyCap: 1 }), appliedToday: 1, jobAlerts: alerts }),
    );
    expect(capped.items.map((i) => i.kind)).toEqual(["inbox.jobAlerts"]);
  });

  it("wakes an idle pilot for the next harvest slot", () => {
    const agenda = buildAgenda(
      base({
        config: cfg({ checkIntervalMinutes: 240 }),
        nextJobAlertsAt: new Date(NOW.getTime() + 45 * 60_000),
      }),
    );
    expect(agenda.sleepSeconds).toBe(45 * 60);
  });
});

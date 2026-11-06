import { buildTaskList } from "./build";
import { base, cfg, job } from "./builders";
import { jobAlertsDue } from "./gather/job-alerts";
import { describe, expect, it } from "bun:test";

// In UTC the 08:00 slot has struck and 17:00 is ahead.
const NOW = new Date("2026-07-15T12:00:00.000Z");
const enabled = cfg({ jobAlerts: { enabled: true, runHours: [8, 17], timeZone: "UTC" } }).jobAlerts;
const at = (iso: string) => new Date(iso);
const run = (startedAt: string, outcome: "done" | "failed" | "expired" | null) => ({
  startedAt: at(startedAt),
  finishedAt: outcome ? at(startedAt) : null,
  outcome,
});

describe("jobAlertsDue", () => {
  it("is never due while the import is off", () => {
    expect(jobAlertsDue(cfg().jobAlerts, null, NOW)).toBe(false);
  });

  it("is due on the first run", () => {
    expect(jobAlertsDue(enabled, null, NOW)).toBe(true);
  });

  it("runs once per slot: a success after 08:00 holds until 17:00", () => {
    expect(jobAlertsDue(enabled, run("2026-07-15T08:05:00Z", "done"), NOW)).toBe(false);
    expect(jobAlertsDue(enabled, run("2026-07-14T17:05:00Z", "done"), NOW)).toBe(true);
  });

  it("stays quiet while an import is in flight", () => {
    expect(jobAlertsDue(enabled, run("2026-07-15T11:58:00Z", null), NOW)).toBe(false);
  });

  it("retries a failed import after the retry gap, not the next slot", () => {
    expect(jobAlertsDue(enabled, run("2026-07-15T11:30:00Z", "failed"), NOW)).toBe(false);
    expect(jobAlertsDue(enabled, run("2026-07-15T10:30:00Z", "expired"), NOW)).toBe(true);
  });
});

describe("buildTaskList inbox.jobAlerts", () => {
  const jobAlerts = {
    messageIds: ["e1", "e2"],
    count: 2,
    minScore: 60,
    senderDomains: ["linkedin.com"],
  };
  const taskTypes = (input: Parameters<typeof base>[0]) =>
    buildTaskList(base(input)).tasks.map((task) => task.taskType);

  it("ranks below applies and still runs once the daily cap is spent", () => {
    expect(taskTypes({ approvedJobs: [job("j1", 80)], jobAlerts })).toEqual([
      "job.apply",
      "inbox.jobAlerts",
    ]);
    expect(taskTypes({ config: cfg({ dailyApplyCap: 1 }), appliedToday: 1, jobAlerts })).toEqual([
      "inbox.jobAlerts",
    ]);
  });

  it("wakes an idle pilot for the next import slot", () => {
    const taskList = buildTaskList(
      base({
        config: cfg({
          checkIntervalMinutes: 240,
          jobAlerts: { enabled: true, runHours: [13], timeZone: "UTC" },
        }),
      }),
    );
    expect(taskList.sleepSeconds).toBe(60 * 60);
  });
});

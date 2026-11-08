import { DAY_MS } from "@/common/date/buckets";
import { buildNotices, type NoticeFacts } from "./notice-signals";
import { describe, expect, it } from "bun:test";

const now = new Date("2026-11-06T12:00:00Z");

/** A healthy user: nothing to flag. */
function facts(overrides: Partial<NoticeFacts> = {}): NoticeFacts {
  return {
    boardlessSearches: 0,
    email: "connected",
    staleMail: 0,
    recentApplications: 30,
    progressed: 1,
    recruiterReplies: 0,
    nearMisses: 0,
    minScore: 60,
    dailyApplyCap: 20,
    autopilotSince: new Date(now.getTime() - 30 * DAY_MS),
    appliedLastWeek: 70,
    approvedWaiting: 0,
    ...overrides,
  };
}

const keys = (input: NoticeFacts) => buildNotices(input, now).map((notice) => notice.key);

describe("buildNotices", () => {
  it("shows nothing for a healthy user", () => {
    expect(keys(facts())).toEqual([]);
  });

  it("flags searches that can't run for want of a board", () => {
    expect(keys(facts({ boardlessSearches: 2 }))).toEqual(["boards.none"]);
  });

  it("flags missing or broken email, and holds back the inbox and outcomes signals", () => {
    const quiet = { staleMail: 5, progressed: 0 };
    expect(keys(facts({ email: "missing", ...quiet }))).toEqual(["email.missing"]);
    const [notice] = buildNotices(facts({ email: "reconnect" }), now);
    expect(notice.action).toMatchObject({ kind: "link", label: "Reconnect" });
  });

  it("holds back outcomes while mail is unread, then shows them once it's read", () => {
    expect(keys(facts({ staleMail: 3, progressed: 0 }))).toEqual(["inbox.unread"]);
    expect(keys(facts({ progressed: 0 }))).toEqual(["outcomes.none"]);
  });

  it("needs 25 applications and no progress or recruiter reply for outcomes", () => {
    expect(keys(facts({ recentApplications: 24, progressed: 0 }))).toEqual([]);
    expect(keys(facts({ progressed: 0, recruiterReplies: 1 }))).toEqual([]);
  });

  it("proposes a lower min score after 10 near misses, never below zero", () => {
    expect(keys(facts({ nearMisses: 9 }))).toEqual([]);
    const [notice] = buildNotices(facts({ nearMisses: 10 }), now);
    expect(notice.action).toMatchObject({ actions: [{ type: "rules.set", minScore: 55 }] });
    const [low] = buildNotices(facts({ nearMisses: 10, minScore: 3 }), now);
    expect(low.action).toMatchObject({ actions: [{ type: "rules.set", minScore: 0 }] });
    expect(keys(facts({ nearMisses: 10, minScore: 0 }))).toEqual([]);
  });

  it("flags an unused cap after a week of autopilot with nothing approved", () => {
    const slow = { appliedLastWeek: 34 }; // under 5 a day against a cap of 20
    expect(keys(facts(slow))).toEqual(["cap.unused"]);
    expect(keys(facts({ appliedLastWeek: 35 }))).toEqual([]);
    expect(keys(facts({ ...slow, approvedWaiting: 1 }))).toEqual([]);
    expect(keys(facts({ ...slow, autopilotSince: null }))).toEqual([]);
    const recent = new Date(now.getTime() - 6 * DAY_MS);
    expect(keys(facts({ ...slow, autopilotSince: recent }))).toEqual([]);
  });
});

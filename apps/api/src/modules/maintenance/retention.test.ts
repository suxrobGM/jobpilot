import { DAY_MS } from "@/common/date/buckets";
import {
  applicationEventWhere,
  claimDiscoverWhere,
  claimReleasedWhere,
  cutoffs,
  emailBodyWhere,
  journalDigestOldWhere,
  journalOldWhere,
  promotionPostWhere,
  questionTerminalWhere,
  RETENTION_DAYS,
  refreshTokenWhere,
  verificationTokenWhere,
} from "./retention";
import { describe, expect, it } from "bun:test";

const NOW = new Date("2026-07-21T00:00:00.000Z");

function daysBefore(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

describe("cutoffs", () => {
  it("computes one cutoff per rule at its configured window", () => {
    const c = cutoffs(NOW);
    expect(c.journal).toEqual(daysBefore(RETENTION_DAYS.journal));
    expect(c.journalDigest).toEqual(daysBefore(RETENTION_DAYS.journalDigest));
    expect(c.claim).toEqual(daysBefore(RETENTION_DAYS.claim));
    expect(c.claimDiscover).toEqual(daysBefore(RETENTION_DAYS.claimDiscover));
    expect(c.question).toEqual(daysBefore(RETENTION_DAYS.question));
    expect(c.token).toEqual(daysBefore(RETENTION_DAYS.token));
    expect(c.promotion).toEqual(daysBefore(RETENTION_DAYS.promotion));
    expect(c.emailBody).toEqual(daysBefore(RETENTION_DAYS.emailBody));
    expect(c.applicationEvent).toEqual(daysBefore(RETENTION_DAYS.applicationEvent));
  });
});

describe("where-builders", () => {
  const c = cutoffs(NOW);

  it("journalOldWhere excludes digest entries", () => {
    expect(journalOldWhere(c)).toEqual({ createdAt: { lt: c.journal }, kind: { not: "digest" } });
  });

  it("journalDigestOldWhere targets only digests on the longer window", () => {
    expect(journalDigestOldWhere(c)).toEqual({
      kind: "digest",
      createdAt: { lt: c.journalDigest },
    });
  });

  it("claimReleasedWhere never matches an open claim (releasedAt null) and excludes search.discover", () => {
    const where = claimReleasedWhere(c);
    expect(where).toEqual({
      releasedAt: { not: null, lt: c.claim },
      kind: { not: "search.discover" },
    });
  });

  it("claimDiscoverWhere isolates search.discover on the 90d tier", () => {
    expect(claimDiscoverWhere(c)).toEqual({
      kind: "search.discover",
      releasedAt: { not: null, lt: c.claimDiscover },
    });
  });

  it("questionTerminalWhere never includes open, and keeps answered email/campaign tombstones", () => {
    const where = questionTerminalWhere(c);
    expect(where).toEqual({
      createdAt: { lt: c.question },
      OR: [
        { status: { in: ["expired", "cancelled"] } },
        { status: "answered", subjectType: { notIn: ["email", "campaign"] } },
        { status: "answered", subjectType: null },
      ],
    });
    expect(JSON.stringify(where)).not.toContain('"open"');
  });

  it("keeps claims at least as long as the questions they consume", () => {
    expect(RETENTION_DAYS.claim).toBeGreaterThanOrEqual(RETENTION_DAYS.question);
  });

  it("verificationTokenWhere matches expiry or consumption past grace", () => {
    expect(verificationTokenWhere(c)).toEqual({
      OR: [{ expiresAt: { lt: c.token } }, { consumedAt: { lt: c.token } }],
    });
  });

  it("refreshTokenWhere matches expiry or revocation past grace", () => {
    expect(refreshTokenWhere(c)).toEqual({
      OR: [{ expiresAt: { lt: c.token } }, { revokedAt: { lt: c.token } }],
    });
  });

  it("promotionPostWhere only targets terminal statuses", () => {
    const where = promotionPostWhere(c);
    expect(where).toEqual({
      status: { in: ["declined", "skipped", "expired", "failed"] },
      updatedAt: { lt: c.promotion },
    });
    for (const kept of ["draft", "approved", "posted"]) {
      expect((where.status as { in: string[] }).in).not.toContain(kept);
    }
  });

  it("emailBodyWhere skips already-blanked rows and messages still awaiting classification", () => {
    expect(emailBodyWhere(c)).toEqual({
      receivedAt: { lt: c.emailBody },
      rawBody: { not: "" },
      scannedAt: { not: null },
    });
  });

  it("applicationEventWhere spares the timeline of a live application", () => {
    expect(applicationEventWhere(c)).toEqual({
      createdAt: { lt: c.applicationEvent },
      application: { status: { in: ["rejected", "withdrawn"] } },
    });
    for (const live of ["applied", "screening", "interviewing", "offer"]) {
      expect(
        (applicationEventWhere(c).application as { status: { in: string[] } }).status.in,
      ).not.toContain(live);
    }
  });
});

import type { PrismaClient } from "@/generated/prisma/client";
import { runRetentionCleanup } from "./cleanup";
import { describe, expect, it } from "bun:test";

interface Call {
  where: Record<string, unknown>;
  data?: Record<string, unknown>;
}

function fakePrisma() {
  const calls: Record<string, Call[]> = {};
  // A distinct count per call, so a swapped field in the returned counts object fails this test.
  const model = (name: string, ...counts: number[]) => {
    let call = 0;
    const record = (where: Record<string, unknown>, data?: Record<string, unknown>) => {
      calls[name] ??= [];
      calls[name].push({ where, data });
      return { count: counts[call++] ?? 0 };
    };
    return {
      deleteMany: async (args: { where: Record<string, unknown> }) => record(args.where),
      updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) =>
        record(args.where, args.data),
    };
  };

  const db = {
    pilotJournalEntry: model("pilotJournalEntry", 1, 2),
    pilotRun: model("pilotRun", 3, 4),
    pilotQuestion: model("pilotQuestion", 5),
    verificationToken: model("verificationToken", 6),
    authToken: model("authToken", 7),
    promotionPost: model("promotionPost", 8),
    emailMessage: model("emailMessage", 9),
    applicationEvent: model("applicationEvent", 10),
    resumeVariant: model("resumeVariant", 11),
  };

  return { db: db as unknown as PrismaClient, calls };
}

describe("runRetentionCleanup", () => {
  it("issues one call per table with the expected where-clauses", async () => {
    const { db, calls } = fakePrisma();
    const counts = await runRetentionCleanup(db);

    // pilot_journal_entries: two separate deletes, non-digest at 30d and digest at 90d.
    expect(calls.pilotJournalEntry).toHaveLength(2);
    expect(calls.pilotJournalEntry?.[0]?.where).toMatchObject({ kind: { not: "digest" } });
    expect(calls.pilotJournalEntry?.[1]?.where).toMatchObject({ kind: "digest" });

    // pilot_runs: finished ones excluding search.discover, then search.discover on the longer window.
    // Never touches open runs - finishedAt.not must be null, not omitted.
    expect(calls.pilotRun).toHaveLength(2);
    const finishedWhere = calls.pilotRun?.[0]?.where as { finishedAt: { not: unknown } };
    expect(finishedWhere.finishedAt.not).toBeNull();
    expect(calls.pilotRun?.[0]?.where).toMatchObject({ taskType: { not: "search.discover" } });
    expect(calls.pilotRun?.[1]?.where).toMatchObject({ taskType: "search.discover" });

    // pilot_questions: terminal statuses only, never open.
    expect(calls.pilotQuestion).toHaveLength(1);
    expect(JSON.stringify(calls.pilotQuestion?.[0]?.where)).not.toContain('"open"');

    expect(calls.verificationToken).toHaveLength(1);
    expect(calls.authToken).toHaveLength(1);

    expect(calls.promotionPost).toHaveLength(1);
    const promoWhere = calls.promotionPost?.[0]?.where as { status: { in: string[] } };
    for (const kept of ["draft", "approved", "posted"]) {
      expect(promoWhere.status.in).not.toContain(kept);
    }

    // email_messages: blanked via updateMany, never deleted.
    expect(calls.emailMessage).toHaveLength(1);
    expect(calls.emailMessage?.[0]?.data).toEqual({ rawBody: "", links: [] });
    expect(calls.emailMessage?.[0]?.where).toMatchObject({ rawBody: { not: "" } });

    // application_events: only for applications that are already closed.
    expect(calls.applicationEvent).toHaveLength(1);
    expect(calls.applicationEvent?.[0]?.where).toMatchObject({
      application: { status: { in: ["rejected", "withdrawn"] } },
    });

    // resume_variants: only ones nothing points at, and never a reserved label.
    expect(calls.resumeVariant).toHaveLength(1);
    expect(calls.resumeVariant?.[0]?.where).toMatchObject({ applicationId: null });
    expect(JSON.stringify(calls.resumeVariant?.[0]?.where)).toContain("Suggested rewrite");

    expect(counts).toEqual({
      journal: 1,
      journalDigests: 2,
      runs: 3,
      runsDiscover: 4,
      questions: 5,
      verificationTokens: 6,
      authTokens: 7,
      promotions: 8,
      emailBodiesBlanked: 9,
      applicationEvents: 10,
      resumeVariants: 11,
    });
  });
});

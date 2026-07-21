import type { PrismaClient } from "@/generated/prisma/client";
import { runRetentionCleanup } from "./cleanup";
import { describe, expect, it } from "bun:test";

interface Call {
  where: Record<string, unknown>;
  data?: Record<string, unknown>;
}

function fakePrisma() {
  const calls: Record<string, Call[]> = {};
  const model = (name: string, count = 0) => ({
    deleteMany: async (args: { where: Record<string, unknown> }) => {
      calls[name] ??= [];
      calls[name].push({ where: args.where });
      return { count };
    },
    updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      calls[name] ??= [];
      calls[name].push({ where: args.where, data: args.data });
      return { count };
    },
  });

  const db = {
    pilotJournalEntry: model("pilotJournalEntry"),
    pilotClaim: model("pilotClaim"),
    pilotQuestion: model("pilotQuestion"),
    verificationToken: model("verificationToken"),
    refreshToken: model("refreshToken"),
    promotionPost: model("promotionPost"),
    emailMessage: model("emailMessage"),
    applicationEvent: model("applicationEvent"),
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

    // pilot_claims: released at 14d excluding search.discover, then search.discover at 90d.
    // Never touches open claims - releasedAt.not must be null, not omitted.
    expect(calls.pilotClaim).toHaveLength(2);
    const releasedWhere = calls.pilotClaim?.[0]?.where as { releasedAt: { not: unknown } };
    expect(releasedWhere.releasedAt.not).toBeNull();
    expect(calls.pilotClaim?.[0]?.where).toMatchObject({ kind: { not: "search.discover" } });
    expect(calls.pilotClaim?.[1]?.where).toMatchObject({ kind: "search.discover" });

    // pilot_questions: terminal statuses only, never open.
    expect(calls.pilotQuestion).toHaveLength(1);
    const questionWhere = calls.pilotQuestion?.[0]?.where as { status: { in: string[] } };
    expect(questionWhere.status.in).not.toContain("open");

    expect(calls.verificationToken).toHaveLength(1);
    expect(calls.refreshToken).toHaveLength(1);

    expect(calls.promotionPost).toHaveLength(1);
    const promoWhere = calls.promotionPost?.[0]?.where as { status: { in: string[] } };
    for (const kept of ["draft", "approved", "posted"]) {
      expect(promoWhere.status.in).not.toContain(kept);
    }

    // email_messages: blanked via updateMany, never deleted.
    expect(calls.emailMessage).toHaveLength(1);
    expect(calls.emailMessage?.[0]?.data).toEqual({ rawBody: "" });
    expect(calls.emailMessage?.[0]?.where).toMatchObject({ rawBody: { not: "" } });

    expect(calls.applicationEvent).toHaveLength(1);

    expect(counts).toEqual({
      journal: 0,
      journalDigests: 0,
      claims: 0,
      claimsDiscover: 0,
      questions: 0,
      verificationTokens: 0,
      refreshTokens: 0,
      promotions: 0,
      emailBodiesBlanked: 0,
      applicationEvents: 0,
    });
  });
});

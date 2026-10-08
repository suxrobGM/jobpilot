import {
  INTERRUPTED_REASON,
  isAwaitingRecoveryAnswer,
  MAYBE_SUBMITTED_REASON,
} from "@jobpilot/contracts/campaign";
import { recoverApplyingJobs } from "./recover-applying";

type RecoveryWriter = Parameters<typeof recoverApplyingJobs>[0];

import { describe, expect, it } from "bun:test";

const STAMPED = {
  campaignId: "c1",
  key: "j1",
  title: "Director of Engineering",
  company: "Acme",
  submitAttemptedAt: new Date("2026-08-10T12:00:00Z"),
};

const UNSTAMPED = {
  campaignId: "c1",
  key: "j2",
  title: "Head of Platform",
  company: "Globex",
  submitAttemptedAt: null,
};

type Row = typeof STAMPED | typeof UNSTAMPED;

interface Update {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
}

interface Harness {
  db: RecoveryWriter;
  updates: Update[];
  questions: Array<Record<string, unknown>>;
  reads: Array<Record<string, unknown>>;
}

/**
 * Applies the parts of the `where` recovery actually depends on, so a test can fail. A fake that
 * returns its fixture regardless of the predicate cannot tell "parked the right rows" from
 * "parked everything".
 */
function matches(row: Row, where: Record<string, unknown>): boolean {
  const or = where.OR as Array<{ campaignId: string; key: string }> | undefined;
  if (or && !or.some((ref) => ref.campaignId === row.campaignId && ref.key === row.key)) {
    return false;
  }
  const and = where.AND as Array<Record<string, unknown>> | undefined;
  if (and && !and.every((clause) => matches(row, clause))) return false;
  return true;
}

function harness(rows: Row[], options: { openQuestionSubjectIds?: string[] } = {}): Harness {
  const updates: Update[] = [];
  const questions: Harness["questions"] = [];
  const reads: Harness["reads"] = [];
  // Mirrors the write: rows recovery has parked leave `applying`, and the re-read only sees those.
  const parked = new Set<string>();

  const db = {
    job: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        reads.push(where);
        if (where.status === "needs_user") {
          return rows.filter((r) => parked.has(`${r.campaignId}:${r.key}`) && matches(r, where));
        }
        return rows.filter((r) => matches(r, where));
      },
      updateMany: async ({ where, data }: Update) => {
        updates.push({ where, data });
        const hit = rows.filter((r) => matches(r, where));
        for (const row of hit) parked.add(`${row.campaignId}:${row.key}`);
        return { count: hit.length };
      },
    },
    pilotQuestion: {
      findMany: async ({ where }: { where: { subjectId: { in: string[] } } }) =>
        (options.openQuestionSubjectIds ?? [])
          .filter((id) => where.subjectId.in.includes(id))
          .map((subjectId) => ({ subjectId })),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        questions.push(data);
        return { id: `q${questions.length}`, ...data };
      },
    },
  };
  return { db: db as unknown as RecoveryWriter, updates, questions, reads };
}

describe("recoverApplyingJobs", () => {
  it("does nothing when nothing was interrupted", async () => {
    const h = harness([]);

    const questions = await recoverApplyingJobs(h.db, "u1", { status: "applying" });

    expect(questions).toEqual([]);
    expect(h.questions).toHaveLength(0);
    expect(h.updates).toHaveLength(0);
  });

  // "Unstamped" means "no information", not "nothing was sent".
  it("parks an interrupted job even when the submit was never marked", async () => {
    const h = harness([UNSTAMPED]);

    await recoverApplyingJobs(h.db, "u1", { status: "applying" });

    expect(h.updates).toHaveLength(1);
    expect(h.updates[0]?.data).toMatchObject({
      status: "needs_user",
      skipReason: INTERRUPTED_REASON,
    });
  });

  it("never re-approves an interrupted job", async () => {
    const h = harness([STAMPED, UNSTAMPED]);

    await recoverApplyingJobs(h.db, "u1", { status: "applying" });

    expect(h.updates.every((u) => u.data.status !== "approved")).toBe(true);
  });

  it("parks a job that may already have been submitted, with the sharper wording", async () => {
    const h = harness([STAMPED]);

    await recoverApplyingJobs(h.db, "u1", { status: "applying" });

    expect(h.updates).toHaveLength(1);
    expect(h.updates[0]?.data).toMatchObject({
      status: "needs_user",
      skipReason: MAYBE_SUBMITTED_REASON,
    });
  });

  it("scopes each write to the rows it read, so an uncapped predicate cannot park extras", async () => {
    const h = harness([STAMPED, UNSTAMPED]);

    await recoverApplyingJobs(h.db, "u1", { status: "applying" });

    const stampedWrite = h.updates.find((u) => u.data.skipReason === MAYBE_SUBMITTED_REASON);
    expect(stampedWrite?.where.AND).toEqual([
      { status: "applying" },
      { OR: [{ campaignId: "c1", key: "j1" }] },
    ]);
  });

  it("issues no write for a bucket with no rows in it", async () => {
    const h = harness([UNSTAMPED]);

    await recoverApplyingJobs(h.db, "u1", { status: "applying" });

    expect(h.updates.every((u) => u.data.skipReason === INTERRUPTED_REASON)).toBe(true);
  });

  // needs_user keeps the campaign active, and nothing else in the agenda surfaces such a job.
  it("asks the user about each parked job so the campaign can finish", async () => {
    const h = harness([STAMPED]);

    const result = await recoverApplyingJobs(h.db, "u1", { status: "applying" });

    expect(h.questions).toHaveLength(1);
    expect(h.questions[0]).toMatchObject({
      userId: "u1",
      kind: "choice",
      subjectType: "job",
      subjectId: "c1:j1",
      deepLink: "/campaigns/c1",
    });
    expect(String(h.questions[0]?.prompt)).toContain("Acme");
    // Returned, not just written: the caller publishes them once its transaction commits.
    expect(result).toHaveLength(1);
  });

  // Without an expiry the sweep can never resolve it, and needs_user is an active status - so an
  // ignored question would keep its campaign in progress forever.
  it("gives the question an expiry, so an ignored one resolves instead of wedging the campaign", async () => {
    const h = harness([UNSTAMPED]);

    await recoverApplyingJobs(h.db, "u1", { status: "applying" });

    const expiresAt = h.questions[0]?.expiresAt as Date;
    expect(expiresAt).toBeInstanceOf(Date);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("does not ask twice about a job that already has an open question", async () => {
    const h = harness([STAMPED], { openQuestionSubjectIds: ["c1:j1"] });

    const result = await recoverApplyingJobs(h.db, "u1", { status: "applying" });

    expect(h.questions).toHaveLength(0);
    expect(result).toHaveLength(0);
  });

  // A row that reached `applied` between the read and the write would otherwise get an
  // unanswerable "did it go through?" against an application already on the record.
  it("asks only about rows the write actually parked", async () => {
    const h = harness([STAMPED]);
    // The row slips to a terminal status just before the write lands, so nothing is parked.
    h.db.job.updateMany = (async () => ({ count: 0 })) as typeof h.db.job.updateMany;

    const result = await recoverApplyingJobs(h.db, "u1", { status: "applying" });

    expect(h.questions).toHaveLength(0);
    expect(result).toHaveLength(0);
  });

  it("keeps the caller's scope on every write", async () => {
    const h = harness([STAMPED, UNSTAMPED]);

    await recoverApplyingJobs(h.db, "u1", {
      status: "applying",
      campaign: { userId: "u1" },
    });

    // A recovery that leaked past its user scope would touch another profile's jobs.
    expect(h.updates.length).toBeGreaterThan(0);
    for (const update of h.updates) {
      const and = update.where.AND as Array<Record<string, unknown>>;
      expect(and[0]).toMatchObject({ campaign: { userId: "u1" } });
    }
    // The re-read is scoped too, or it would surface another user's parked rows.
    const reread = h.reads.find((w) => w.status === "needs_user");
    expect(reread).toMatchObject({ campaign: { userId: "u1" } });
  });
});

describe("isAwaitingRecoveryAnswer", () => {
  it("holds a job parked by either recovery reason", () => {
    expect(isAwaitingRecoveryAnswer({ status: "needs_user", skipReason: INTERRUPTED_REASON })).toBe(
      true,
    );
    expect(
      isAwaitingRecoveryAnswer({ status: "needs_user", skipReason: MAYBE_SUBMITTED_REASON }),
    ).toBe(true);
  });

  // A 2FA park is the ordinary needs_user case and must stay resumable in place.
  it("leaves an ordinary needs_user job alone", () => {
    expect(
      isAwaitingRecoveryAnswer({ status: "needs_user", skipReason: "Waiting on a 2FA code." }),
    ).toBe(false);
    expect(isAwaitingRecoveryAnswer({ status: "needs_user", skipReason: null })).toBe(false);
    expect(isAwaitingRecoveryAnswer({ status: "approved", skipReason: INTERRUPTED_REASON })).toBe(
      false,
    );
  });
});

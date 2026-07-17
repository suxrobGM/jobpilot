// The morning-digest writer in isolation via writeDigestIfDue with fake Prisma/Pilot/Push deps - no
// database. Loading the digest module transitively loads `@/env`, satisfied by the dummy env.
import { pilotInstructionsConfigSchema } from "@jobpilot/contracts/pilot";
import { makeAgendaDeps, type Over } from "./db.test-helpers";
import { writeDigestIfDue } from "./digest";
import { describe, expect, it, spyOn } from "bun:test";

const config = pilotInstructionsConfigSchema.parse({});
const MORNING = new Date("2026-07-15T08:00:00.000Z"); // past 07:00 UTC

const run = (over: Over, now: Date, openQuestions: number) => {
  const { prisma, pilot, push, rec } = makeAgendaDeps(over);
  return {
    write: () => writeDigestIfDue({ prisma, pilot, push }, "p1", now, config, openQuestions),
    rec,
  };
};

describe("AgendaService morning digest", () => {
  it("writes one digest entry with counts and fires the digest push", async () => {
    const { write, rec } = run(
      {
        existingDigests: 0,
        digestApps: 3,
        jobsFailed: 1,
        jobsSkipped: 2,
        outreachSent: 4,
        outreachReplies: 1,
        promotionsPosted: 1,
      },
      MORNING,
      5,
    );

    await write();

    expect(rec.journals).toHaveLength(1);
    expect(rec.journals[0]).toMatchObject({ kind: "digest" });
    expect(rec.journals[0].detail).toMatchObject({
      applicationsCreated: 3,
      jobsFailed: 1,
      jobsSkipped: 2,
      openQuestions: 5,
      outreachSent: 4,
      outreachReplies: 1,
      promotionsPosted: 1,
    });
    expect(rec.pushes[0]?.payload).toMatchObject({
      title: "Your Pilot's morning digest",
      tag: "pilot-digest",
    });
  });

  it("does not write a second digest when one already exists for the tz-day", async () => {
    const { write, rec } = run({ existingDigests: 1 }, MORNING, 0);
    await write();
    expect(rec.journals).toHaveLength(0);
    expect(rec.pushes).toHaveLength(0);
  });

  it("writes exactly one digest when two compiles race at the digest hour", async () => {
    const { write, rec } = run({ existingDigests: 0 }, MORNING, 0);
    await Promise.all([write(), write()]);
    expect(rec.journals).toHaveLength(1);
    expect(rec.pushes).toHaveLength(1);
  });

  it("stays quiet before the digest hour", async () => {
    const { write, rec } = run({ existingDigests: 0 }, new Date("2026-07-15T05:00:00.000Z"), 0);
    await write();
    expect(rec.journals).toHaveLength(0);
  });

  it("swallows a db failure and writes nothing", async () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    const { prisma, pilot, push, rec } = makeAgendaDeps({ existingDigests: 0 });
    (
      prisma as unknown as { pilotJournalEntry: { count: () => Promise<number> } }
    ).pilotJournalEntry.count = async () => {
      throw new Error("db down");
    };
    await writeDigestIfDue({ prisma, pilot, push }, "p1", MORNING, config, 0);
    expect(rec.journals).toHaveLength(0);
    expect(rec.pushes).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

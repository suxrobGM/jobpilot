// The morning-digest writer in isolation via writeDigestIfDue with fake Prisma/Pilot/Push deps - no
// database. Loading the digest module transitively loads `@/env`, satisfied by the dummy env.
import { pilotMandateConfigSchema } from "@jobpilot/contracts/pilot";
import { makeAgendaDeps, type Over } from "./db.test-helpers";
import { writeDigestIfDue } from "./digest";
import { describe, expect, it } from "bun:test";

const config = pilotMandateConfigSchema.parse({});
const MORNING = new Date("2026-07-15T08:00:00.000Z"); // past 07:00 UTC

const run = (over: Over, now: Date, openEscalations: number) => {
  const { prisma, pilot, push, rec } = makeAgendaDeps(over);
  return {
    write: () => writeDigestIfDue({ prisma, pilot, push }, "p1", now, config, openEscalations),
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
      openEscalations: 5,
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

  it("stays quiet before the digest hour", async () => {
    const { write, rec } = run({ existingDigests: 0 }, new Date("2026-07-15T05:00:00.000Z"), 0);
    await write();
    expect(rec.journals).toHaveLength(0);
  });
});

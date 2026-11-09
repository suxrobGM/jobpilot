import { DigestService } from "./digest.service";
import { makeTaskListDeps, type Over } from "./fakes";
import { describe, expect, it, spyOn } from "bun:test";

const MORNING = new Date("2026-07-15T08:00:00.000Z"); // past 07:00 UTC

const run = (over: Over, now: Date, openQuestions: number) => {
  const { prisma, messages, rec } = makeTaskListDeps({ digestedToday: false, ...over });
  return {
    write: () => new DigestService(prisma, messages).writeIfDue("p1", now, openQuestions),
    rec,
  };
};

describe("DigestService", () => {
  it("posts one digest message with the day's counts", async () => {
    const { write, rec } = run(
      { digestApps: 3, jobsFailed: 1, jobsSkipped: 2, networkingSent: 4, networkingReplies: 1 },
      MORNING,
      5,
    );

    await write();

    expect(rec.posted).toEqual([
      {
        body: "Last 24h: 3 applications, 3 not applied, 4 networking sent (1 reply), 5 open questions.",
        alert: { title: "Your Pilot's morning digest", tag: "pilot-digest" },
      },
    ]);
  });

  it("posts nothing once today's digest is out", async () => {
    const { write, rec } = run({ digestedToday: true, digestApps: 3 }, MORNING, 0);
    await write();
    expect(rec.posted).toHaveLength(0);
  });

  it("posts exactly one digest when two refreshes race at the digest hour", async () => {
    const { write, rec } = run({ digestApps: 1 }, MORNING, 0);
    await Promise.all([write(), write()]);
    expect(rec.posted).toHaveLength(1);
  });

  it("posts nothing on a day with nothing to report", async () => {
    const { write, rec } = run({}, MORNING, 0);
    await write();
    expect(rec.posted).toHaveLength(0);
  });

  it("stays quiet before the digest hour", async () => {
    const { write, rec } = run({ digestApps: 1 }, new Date("2026-07-15T05:00:00.000Z"), 0);
    await write();
    expect(rec.posted).toHaveLength(0);
  });

  it("swallows a db failure and posts nothing", async () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    const { prisma, messages, rec } = makeTaskListDeps({ digestedToday: false });
    (
      prisma as unknown as { pilotState: { updateMany: () => Promise<never> } }
    ).pilotState.updateMany = async () => {
      throw new Error("db down");
    };
    await new DigestService(prisma, messages).writeIfDue("p1", MORNING, 0);
    expect(rec.posted).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

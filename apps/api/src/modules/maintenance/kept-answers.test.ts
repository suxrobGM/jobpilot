import type { PrismaClient } from "@/generated/prisma/client";
import { deleteStaleAnswers } from "./kept-answers";
import { describe, expect, it } from "bun:test";

const PAUSED_AT = new Date("2026-10-01T00:00:00Z");
const BEFORE_PAUSE = new Date("2026-09-20T00:00:00Z");
const AFTER_PAUSE = new Date("2026-10-02T00:00:00Z");

const FEED_PAUSED = "019a0000-0000-7000-8000-000000000001";
const FEED_RESUMED = "019a0000-0000-7000-8000-000000000002";
const EMAIL_INTERVIEWING = "019a0000-0000-7000-8000-000000000003";
const EMAIL_CLOSED = "019a0000-0000-7000-8000-000000000004";

const QUESTIONS = [
  { id: "this-pause", subjectType: "feed", subjectId: FEED_PAUSED, answeredAt: AFTER_PAUSE },
  { id: "older-pause", subjectType: "feed", subjectId: FEED_PAUSED, answeredAt: BEFORE_PAUSE },
  { id: "resumed", subjectType: "feed", subjectId: FEED_RESUMED, answeredAt: AFTER_PAUSE },
  { id: "interviewing", subjectType: "email", subjectId: EMAIL_INTERVIEWING, answeredAt: null },
  { id: "closed", subjectType: "email", subjectId: EMAIL_CLOSED, answeredAt: null },
  { id: "malformed", subjectType: "feed", subjectId: "not-a-uuid", answeredAt: AFTER_PAUSE },
];

function fakeDb() {
  const deleted: string[] = [];
  const db = {
    pilotQuestion: {
      findMany: async () => QUESTIONS,
      deleteMany: async (args: { where: { id: { in: string[] } } }) => {
        deleted.push(...args.where.id.in);
        return { count: args.where.id.in.length };
      },
    },
    feed: { findMany: async () => [{ id: FEED_PAUSED, pausedAt: PAUSED_AT }] },
    emailMessage: { findMany: async () => [{ id: EMAIL_INTERVIEWING }] },
  };
  return { db: db as unknown as PrismaClient, deleted };
}

describe("deleteStaleAnswers", () => {
  it("keeps only answers that still hold a review back", async () => {
    const { db, deleted } = fakeDb();
    const result = await deleteStaleAnswers(db, new Date());
    expect(deleted.sort()).toEqual(["closed", "malformed", "older-pause", "resumed"]);
    expect(result.count).toBe(4);
  });
});

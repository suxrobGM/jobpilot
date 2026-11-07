import { z } from "zod/v4";
import type { PilotSubjectType, PrismaClient } from "@/generated/prisma/client";

/** Answered questions on these subjects are the only thing that stops the same review re-opening. */
export const QUESTION_TOMBSTONE_SUBJECTS: PilotSubjectType[] = ["email", "feed"];

/** A day's share; a larger backlog clears over the following days. */
const TOMBSTONE_BATCH = 5000;

const uuid = z.uuid();

interface Tombstone {
  id: string;
  subjectType: PilotSubjectType | null;
  subjectId: string | null;
  answeredAt: Date | null;
}

function subjectIds(rows: Tombstone[], type: PilotSubjectType): string[] {
  // A malformed id would make Prisma reject the whole uuid filter.
  return rows.flatMap((row) =>
    row.subjectType === type && row.subjectId && uuid.safeParse(row.subjectId).success
      ? [row.subjectId]
      : [],
  );
}

/**
 * Deletes answered email and search questions that no longer hold a review back: a search
 * answer only counts within the pause it was given in, an interview-reply answer only while the
 * application is still interviewing.
 */
export async function deleteSpentTombstones(
  db: PrismaClient,
  before: Date,
): Promise<{ count: number }> {
  const rows = await db.pilotQuestion.findMany({
    where: {
      status: "answered",
      subjectType: { in: QUESTION_TOMBSTONE_SUBJECTS },
      createdAt: { lt: before },
    },
    select: { id: true, subjectType: true, subjectId: true, answeredAt: true },
    take: TOMBSTONE_BATCH,
  });
  if (rows.length === 0) {
    return { count: 0 };
  }
  const [pausedFeeds, interviewEmails] = await Promise.all([
    db.feed.findMany({
      where: { id: { in: subjectIds(rows, "feed") }, pausedAt: { not: null } },
      select: { id: true, pausedAt: true },
    }),
    db.emailMessage.findMany({
      where: { id: { in: subjectIds(rows, "email") }, application: { status: "interviewing" } },
      select: { id: true },
    }),
  ]);
  const pausedAt = new Map(pausedFeeds.map((feed) => [feed.id, feed.pausedAt]));
  const interviewing = new Set(interviewEmails.map((email) => email.id));

  const stillHolds = (row: Tombstone): boolean => {
    const subjectId = row.subjectId ?? "";
    if (row.subjectType === "email") {
      return interviewing.has(subjectId);
    }
    const paused = pausedAt.get(subjectId);
    return paused != null && row.answeredAt != null && row.answeredAt > paused;
  };
  const spent = rows.filter((row) => !stillHolds(row)).map((row) => row.id);
  if (spent.length === 0) {
    return { count: 0 };
  }
  return db.pilotQuestion.deleteMany({ where: { id: { in: spent } } });
}

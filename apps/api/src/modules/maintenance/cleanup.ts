import type { PrismaClient } from "@/generated/prisma/client";
import {
  applicationEventWhere,
  authTokenWhere,
  cutoffs,
  emailBodyWhere,
  journalDigestOldWhere,
  journalOldWhere,
  promotionPostWhere,
  questionTerminalWhere,
  type RetentionCutoffs,
  resumeVariantWhere,
  runDiscoverWhere,
  runFinishedWhere,
  verificationTokenWhere,
} from "./retention";

interface RetentionRule {
  key: string;
  run: (db: PrismaClient, c: RetentionCutoffs) => Promise<{ count: number }>;
}

/** One entry per rule: the reported count key and the write are declared together, so they cannot drift apart. */
const RULES = [
  {
    key: "journal",
    run: (db, c) => db.pilotJournalEntry.deleteMany({ where: journalOldWhere(c) }),
  },
  {
    key: "journalDigests",
    run: (db, c) => db.pilotJournalEntry.deleteMany({ where: journalDigestOldWhere(c) }),
  },
  { key: "runs", run: (db, c) => db.pilotRun.deleteMany({ where: runFinishedWhere(c) }) },
  {
    key: "runsDiscover",
    run: (db, c) => db.pilotRun.deleteMany({ where: runDiscoverWhere(c) }),
  },
  {
    key: "questions",
    run: (db, c) => db.pilotQuestion.deleteMany({ where: questionTerminalWhere(c) }),
  },
  {
    key: "verificationTokens",
    run: (db, c) => db.verificationToken.deleteMany({ where: verificationTokenWhere(c) }),
  },
  {
    key: "authTokens",
    run: (db, c) => db.authToken.deleteMany({ where: authTokenWhere(c) }),
  },
  {
    key: "promotions",
    run: (db, c) => db.promotionPost.deleteMany({ where: promotionPostWhere(c) }),
  },
  {
    key: "emailBodiesBlanked",
    run: (db, c) =>
      db.emailMessage.updateMany({ where: emailBodyWhere(c), data: { rawBody: "", links: [] } }),
  },
  {
    key: "applicationEvents",
    run: (db, c) => db.applicationEvent.deleteMany({ where: applicationEventWhere(c) }),
  },
  {
    key: "resumeVariants",
    run: (db, c) => db.resumeVariant.deleteMany({ where: resumeVariantWhere(c) }),
  },
] as const satisfies readonly RetentionRule[];

export type RetentionCounts = Record<(typeof RULES)[number]["key"], number>;

/** Runs every retention rule sequentially against the given client; accepts prisma as a param for testability. */
export async function runRetentionCleanup(prisma: PrismaClient): Promise<RetentionCounts> {
  const c = cutoffs(new Date());
  const counts = {} as RetentionCounts;

  for (const rule of RULES) {
    counts[rule.key] = (await rule.run(prisma, c)).count;
  }

  return counts;
}

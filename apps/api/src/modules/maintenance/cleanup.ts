import type { PrismaClient } from "@/generated/prisma/client";
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
  refreshTokenWhere,
  verificationTokenWhere,
} from "./retention";

export interface RetentionCounts {
  journal: number;
  journalDigests: number;
  claims: number;
  claimsDiscover: number;
  questions: number;
  verificationTokens: number;
  refreshTokens: number;
  promotions: number;
  emailBodiesBlanked: number;
  applicationEvents: number;
}

/** Runs every retention rule sequentially against the given client; accepts prisma as a param for testability. */
export async function runRetentionCleanup(prisma: PrismaClient): Promise<RetentionCounts> {
  const c = cutoffs(new Date());

  const journal = await prisma.pilotJournalEntry.deleteMany({ where: journalOldWhere(c) });
  const journalDigests = await prisma.pilotJournalEntry.deleteMany({
    where: journalDigestOldWhere(c),
  });
  const claims = await prisma.pilotClaim.deleteMany({ where: claimReleasedWhere(c) });
  const claimsDiscover = await prisma.pilotClaim.deleteMany({ where: claimDiscoverWhere(c) });
  const questions = await prisma.pilotQuestion.deleteMany({ where: questionTerminalWhere(c) });
  const verificationTokens = await prisma.verificationToken.deleteMany({
    where: verificationTokenWhere(c),
  });
  const refreshTokens = await prisma.refreshToken.deleteMany({ where: refreshTokenWhere(c) });
  const promotions = await prisma.promotionPost.deleteMany({ where: promotionPostWhere(c) });
  const emailBodiesBlanked = await prisma.emailMessage.updateMany({
    where: emailBodyWhere(c),
    data: { rawBody: "" },
  });
  const applicationEvents = await prisma.applicationEvent.deleteMany({
    where: applicationEventWhere(c),
  });

  return {
    journal: journal.count,
    journalDigests: journalDigests.count,
    claims: claims.count,
    claimsDiscover: claimsDiscover.count,
    questions: questions.count,
    verificationTokens: verificationTokens.count,
    refreshTokens: refreshTokens.count,
    promotions: promotions.count,
    emailBodiesBlanked: emailBodiesBlanked.count,
    applicationEvents: applicationEvents.count,
  };
}

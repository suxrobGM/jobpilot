import type { Prisma } from "@/generated/prisma/client";
import { ok } from "@/lib/api";
import { parseQueryParams } from "@/lib/api/request";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { reviewStatus, classification, since, domainHint, verificationDomain } =
    parseQueryParams(req, [
      "reviewStatus",
      "classification",
      "since",
      "domainHint",
      "verificationDomain",
    ] as const);

  const where: Prisma.EmailMessageWhereInput = {};

  if (reviewStatus) where.reviewStatus = reviewStatus;
  if (classification === "null") {
    where.classification = null;
  } else if (classification) {
    where.classification = classification;
  }
  if (since) {
    const date = new Date(since);
    if (!Number.isNaN(date.getTime())) where.receivedAt = { gte: date };
  }
  if (verificationDomain) {
    where.verificationDomain = verificationDomain;
  }
  if (domainHint) {
    where.OR = [
      { fromDomain: { contains: domainHint } },
      { subject: { contains: domainHint } },
      { rawBody: { contains: domainHint } },
    ];
  }

  const messages = await db.emailMessage.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    take: 200,
    include: {
      matchedApp: { select: { id: true, title: true, company: true, stage: true } },
    },
  });

  return ok(messages);
}

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { applyRetention, RETENTION_RULES, type RetentionRuleName } from "./retention";
import { describe, expect, it } from "bun:test";

type Retention = readonly RetentionRuleName[] | "bounded" | "userData";

/**
 * Every model, by how it stays small: the rules that trim it, `bounded` (one row per user or a
 * small catalog), or `userData` (the user's own records, deleted with the account). A new model
 * fails typecheck here until it gets one.
 */
const RETENTION_BY_MODEL = {
  Application: "userData",
  ApplicationEvent: ["applicationEvents"],
  VerificationToken: ["verificationTokens"],
  OAuthAccount: "bounded",
  AuthToken: ["authTokens"],
  Job: ["staleFoundJobs", "droppedJobTexts", "droppedJobs"],
  Feed: ["emptyArchivedSearches"],
  CoverLetter: "userData",
  Credential: "bounded",
  EmailAccount: "bounded",
  EmailOAuthClient: "bounded",
  EmailMessage: ["emailBodies", "irrelevantEmails"],
  JobBoard: "bounded",
  UserJobBoard: "bounded",
  JobListing: ["unseenListings"],
  JobListingSource: ["unseenListings"],
  Contact: "userData",
  NetworkingMessage: "userData",
  PilotState: "bounded",
  PilotRun: ["runs", "discoveryRuns"],
  PilotQuestion: ["questions"],
  PilotJournalEntry: ["journalEntries", "digests"],
  PromotionPost: ["promotionPosts"],
  PilotChange: ["staleProposals", "decidedChanges"],
  PilotMessage: ["messages"],
  PilotRequest: ["requests"],
  Profile: "bounded",
  ProfessionalReference: "userData",
  SalaryPreference: "userData",
  ProfileAnswer: "userData",
  Resume: "userData",
  ResumeVariant: ["resumeVariants"],
  UpworkProposal: "userData",
  UpworkProfile: "bounded",
  UpworkAccount: "bounded",
  UpworkInboxItem: "userData",
  User: "bounded",
  WebPushSubscription: "bounded",
} as const satisfies Record<Prisma.ModelName, Retention>;

/** Records the where-clause each rule sends, keyed by rule name. */
async function whereByRule(): Promise<Record<RetentionRuleName, string>> {
  const wheres: Partial<Record<RetentionRuleName, string>> = {};
  let current: RetentionRuleName = RETENTION_RULES[0].name;
  const record = async (args: { where: unknown }) => {
    wheres[current] = JSON.stringify(args.where);
    return { count: 0 };
  };
  const db = new Proxy({}, { get: () => ({ deleteMany: record, updateMany: record }) });
  for (const rule of RETENTION_RULES) {
    current = rule.name;
    await rule.apply(db as PrismaClient, new Date());
  }
  return wheres as Record<RetentionRuleName, string>;
}

function days(name: RetentionRuleName): number {
  return RETENTION_RULES.find((rule) => rule.name === name)?.days ?? 0;
}

describe("retention", () => {
  it("runs exactly the rules the models list", async () => {
    const db = new Proxy({}, { get: () => ({ deleteMany: zero, updateMany: zero }) });
    const counts = await applyRetention(db as PrismaClient, new Date());
    const listed = Object.values(RETENTION_BY_MODEL).flatMap((retention) =>
      typeof retention === "string" ? [] : retention,
    );
    expect(new Set(Object.keys(counts))).toEqual(new Set(listed));
  });

  it("never touches a row something still reads or waits on", async () => {
    const where = await whereByRule();
    // Open runs and requests have no finishedAt.
    for (const name of ["runs", "discoveryRuns", "requests"] as const) {
      expect(where[name]).toContain('"finishedAt":{"not":null');
    }
    // Proposals have no decidedAt.
    expect(where.decidedChanges).toContain('"decidedAt"');
    expect(where.questions).not.toContain('"open"');
    expect(where.questions).toContain('"notIn":["email","feed"]');
    for (const kept of ["draft", "approved", "posted"]) {
      expect(where.promotionPosts).not.toContain(`"${kept}"`);
    }
    expect(where.emailBodies).toContain('"scannedAt":{"not":null}');
    for (const live of ["applied", "screening", "interviewing", "offer"]) {
      expect(where.applicationEvents).not.toContain(`"${live}"`);
    }
    expect(where.droppedJobs).toContain('"applications":{"none":{}}');
    expect(where.droppedJobs).toContain('"upworkProposals":{"none":{}}');
    expect(where.staleFoundJobs).toContain('"upworkProposals":{"none":{}}');
    expect(where.resumeVariants).toContain('"applicationId":null');
    expect(where.resumeVariants).toContain("Suggested rewrite");
  });

  it("keeps runs at least as long as the questions they consume", () => {
    expect(days("runs")).toBeGreaterThanOrEqual(days("questions"));
  });

  it("deletes resume variants only after the reuse scorer has stopped preferring them", () => {
    expect(days("resumeVariants")).toBeLessThanOrEqual(180);
  });
});

async function zero() {
  return { count: 0 };
}

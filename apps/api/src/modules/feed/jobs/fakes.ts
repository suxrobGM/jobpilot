// Shared fake-Prisma scaffolding for the JobService suites: one mutable job row plus the
// application/variant/cover-letter writes its result path touches.
import { DAY_MS } from "@/common/date/buckets";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { makeBoards } from "@/modules/job-board/job-board.fake";
import type { JobListingPublisher } from "@/modules/job-listing/publishing/job-listing.publisher";
import { guardApply } from "./apply-guard";
import { startApplying } from "./applying";
import { JobService } from "./job.service";

/** Relative to now, so the duplicate fixtures stay inside the window as the calendar moves. */
export const APPLIED_AT = new Date(Date.now() - 5 * DAY_MS).toISOString();

export const OWNED_RESUME_ID = "11111111-1111-4111-8111-111111111111";
export const OWNED_VARIANT_ID = "22222222-2222-4222-8222-222222222222";
export const OTHER_USERS_VARIANT_ID = "33333333-3333-4333-8333-333333333333";

// Prisma skips undefined fields on write; a plain spread would overwrite them.
function withoutUndefined(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

export function setup() {
  let job = {
    id: "j-id",
    feedId: "c1",
    key: "j1",
    title: "Engineer",
    company: "Acme",
    location: null,
    salary: null,
    employmentType: null,
    url: "https://example.test/jobs/1",
    board: "example",
    matchScore: 90,
    matchReason: "fit",
    status: "applying",
    appliedAt: null,
    failReason: null,
    retryNotes: null,
    skipReason: null,
    description: null,
    brief: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let application: Record<string, unknown> | null = null;
  let applicationUpserts = 0;
  const variantLinks: { where: Record<string, unknown>; data: Record<string, unknown> }[] = [];
  const coverLetterLinks: { where: Record<string, unknown>; data: Record<string, unknown> }[] = [];
  const feed = { source: "auto_apply" as const };
  const db = {
    job: {
      findFirst: async () => ({ ...job, feed }),
      // The applying-duplicate scan; no sibling job is mid-apply in these tests.
      findMany: async () => [],
      updateMany: async ({
        where,
        data,
      }: {
        where: { status?: unknown };
        data: Record<string, unknown>;
      }) => {
        if (where.status && typeof where.status === "object" && "notIn" in where.status) {
          if (["applied", "failed", "skipped"].includes(job.status)) {
            return { count: 0 };
          }
        } else if (typeof where.status === "string" && job.status !== where.status) {
          return { count: 0 };
        }
        job = { ...job, ...withoutUndefined(data) } as typeof job;
        return { count: 1 };
      },
      updateManyAndReturn: async ({
        where,
        data,
      }: {
        where: { status?: string | { in: string[] } };
        data: Record<string, unknown>;
      }) => {
        const allowed = typeof where.status === "string" ? [where.status] : where.status?.in;
        if (allowed && !allowed.includes(job.status)) {
          return [];
        }
        job = { ...job, ...withoutUndefined(data) } as typeof job;
        return [job];
      },
      findUniqueOrThrow: async () => job,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        job = { ...job, ...withoutUndefined(data) } as typeof job;
        return job;
      },
      groupBy: async () => [{ feedId: job.feedId, status: job.status, _count: { _all: 1 } }],
    },
    application: {
      findUnique: async () => application,
      findMany: async () => (application ? [application] : []),
      upsert: async ({
        create,
        update,
      }: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        applicationUpserts += 1;
        application = application ? { ...application, ...update } : { id: "app1", ...create };
        return application;
      },
    },
    feed: {
      findUniqueOrThrow: async () => feed,
    },
    networkingMessage: {
      groupBy: async () => [],
    },
    resume: {
      findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
        where.id === OWNED_RESUME_ID && where.userId === "u1" ? { id: OWNED_RESUME_ID } : null,
    },
    resumeVariant: {
      findFirst: async ({ where }: { where: { id: string; resume: { userId: string } } }) =>
        where.id === OWNED_VARIANT_ID && where.resume.userId === "u1"
          ? { id: OWNED_VARIANT_ID, resumeId: OWNED_RESUME_ID }
          : null,
      updateMany: async (args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        variantLinks.push(args);
        return { count: 1 };
      },
    },
    coverLetter: {
      updateMany: async (args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        coverLetterLinks.push(args);
        return { count: 1 };
      },
    },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(db),
  };
  const listings = { publishInBackground: () => undefined } as unknown as JobListingPublisher;
  const service = new JobService(db as unknown as PrismaClient, listings, makeBoards());
  return {
    service,
    /** Starting a job.apply run: the move happens in a transaction wrapped in the duplicate guard. */
    startApplying: () =>
      guardApply(db as unknown as PrismaClient, "u1", () =>
        startApplying(db as unknown as Prisma.TransactionClient, "u1", { feedId: "c1", key: "j1" }),
      ),
    get job() {
      return job;
    },
    get applicationUpserts() {
      return applicationUpserts;
    },
    variantLinks,
    coverLetterLinks,
    setStatus(status: string) {
      job = { ...job, status };
    },
    setApplication(row: Record<string, unknown>) {
      application = row;
    },
  };
}

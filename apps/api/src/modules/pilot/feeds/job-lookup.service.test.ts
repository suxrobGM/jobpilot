import type { PrismaClient } from "@/generated/prisma/client";
import { JobLookupService } from "./job-lookup.service";
import { describe, expect, it } from "bun:test";

const stored = {
  feedId: "c1",
  key: "k1",
  title: "Research Assistant, Vision Lab",
  company: "University of Michigan",
  location: "Ann Arbor, MI",
  url: "https://careers.umich.edu/job_detail/1",
  status: "skipped" as const,
};

const db = { job: { findMany: async () => [stored] } };

describe("JobLookupService.findSimilar", () => {
  it("matches a mirror of a stored posting, skipped ones included, by request index", async () => {
    const svc = new JobLookupService(db as unknown as PrismaClient);
    const result = await svc.findSimilar("u1", {
      postings: [
        { title: "Data Engineer", company: "University of Michigan" },
        { title: "Research Assistant, Vision Lab", company: "University of Michigan" },
      ],
      withinDays: 30,
    });
    expect(result.matches).toEqual([{ index: 1, ...stored }]);
  });
});

describe("JobLookupService.findExisting", () => {
  it("returns the URLs as sent whose normalized form is already stored", async () => {
    const urlsQueried: string[][] = [];
    const urlDb = {
      job: {
        findMany: async (args: { where: { url: { in: string[] } } }) => {
          urlsQueried.push(args.where.url.in);
          return args.where.url.in
            .filter((url) => url === "https://acme.com/jobs/1")
            .map((url) => ({ url }));
        },
      },
    };
    const svc = new JobLookupService(urlDb as unknown as PrismaClient);
    const sent = ["https://www.acme.com/jobs/1/?utm_source=alert", "https://acme.com/jobs/2"];
    expect(await svc.findExisting("u1", { urls: sent, withinDays: 7 })).toEqual({
      existing: [sent[0]],
    });
    expect(urlsQueried[0]).toEqual(["https://acme.com/jobs/1", "https://acme.com/jobs/2"]);
  });
});

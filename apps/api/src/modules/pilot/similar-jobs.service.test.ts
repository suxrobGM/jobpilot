import type { PrismaClient } from "@/generated/prisma/client";
import { SimilarJobsService } from "./similar-jobs.service";
import { describe, expect, it } from "bun:test";

const stored = {
  campaignId: "c1",
  key: "k1",
  title: "Research Assistant, Vision Lab",
  company: "University of Michigan",
  location: "Ann Arbor, MI",
  url: "https://careers.umich.edu/job_detail/1",
  status: "skipped" as const,
};

const db = { campaignJob: { findMany: async () => [stored] } };

describe("SimilarJobsService.findSimilar", () => {
  it("matches a mirror of a stored posting, skipped ones included, by request index", async () => {
    const svc = new SimilarJobsService(db as unknown as PrismaClient);
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

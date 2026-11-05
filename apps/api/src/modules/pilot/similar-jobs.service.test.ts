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

function makeService() {
  const wheres: { createdAt: { gte: Date } }[] = [];
  const db = {
    campaignJob: {
      findMany: async (a: { where: { createdAt: { gte: Date } } }) => {
        wheres.push(a.where);
        return [stored];
      },
    },
  };
  return { svc: new SimilarJobsService(db as unknown as PrismaClient), wheres };
}

describe("SimilarJobsService.findSimilar", () => {
  it("matches a mirror of a stored posting, skipped ones included, by request index", async () => {
    const { svc } = makeService();
    const result = await svc.findSimilar("u1", {
      postings: [
        { title: "Data Engineer", company: "University of Michigan" },
        { title: "Research Assistant, Vision Lab", company: "University of Michigan" },
      ],
      withinDays: 30,
    });
    expect(result.matches).toEqual([{ index: 1, ...stored }]);
  });

  it("does not match the same title at a different employer", async () => {
    const { svc } = makeService();
    const result = await svc.findSimilar("u1", {
      postings: [{ title: "Research Assistant, Vision Lab", company: "Ohio State University" }],
      withinDays: 30,
    });
    expect(result.matches).toEqual([]);
  });

  it("scans only the window", async () => {
    const { svc, wheres } = makeService();
    await svc.findSimilar("u1", { postings: [{ title: "x", company: "y" }], withinDays: 7 });
    const age = Date.now() - wheres[0].createdAt.gte.getTime();
    expect(Math.round(age / 86_400_000)).toBe(7);
  });
});

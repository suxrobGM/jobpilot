import { DAY_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { makeBoards } from "@/modules/job-board/job-board.fake";
import type { JobListingPublisher } from "@/modules/job-listing/publishing/job-listing.publisher";
import { JobService } from "./job.service";
import { describe, expect, it } from "bun:test";

const URL = "https://example.test/jobs/1";

interface StoredJob {
  id: string;
  url: string;
  createdAt: Date;
}

function setup(stored: StoredJob[]) {
  const created: unknown[] = [];
  const row = (id: string, url: string) => ({ id, url, key: id, brief: null, board: null });
  const db = {
    feed: { findFirst: async () => ({ id: "c2" }) },
    job: {
      findFirst: async (args: { where: { url: { in: string[] }; createdAt: { gte: Date } } }) => {
        const hit = stored.find(
          (job) => args.where.url.in.includes(job.url) && job.createdAt >= args.where.createdAt.gte,
        );
        return hit ? row(hit.id, hit.url) : null;
      },
      create: async (args: { data: { url: string } }) => {
        created.push(args.data);
        return row("new", args.data.url);
      },
    },
  };
  const listings = { publishInBackground: () => undefined } as unknown as JobListingPublisher;
  const service = new JobService(db as unknown as PrismaClient, listings, makeBoards());
  const add = () =>
    service.add("u1", "c2", { key: "k", title: "Engineer", company: "Acme", url: URL });
  return { add, created };
}

describe("JobService.addJob", () => {
  it("returns the posting the user already has from the last 30 days instead of adding it", async () => {
    const { add, created } = setup([
      { id: "old", url: URL, createdAt: new Date(Date.now() - 3 * DAY_MS) },
    ]);
    expect(await add()).toMatchObject({ id: "old", duplicate: true });
    expect(created).toHaveLength(0);
  });

  it("adds a posting last seen more than 30 days ago", async () => {
    const { add, created } = setup([
      { id: "old", url: URL, createdAt: new Date(Date.now() - 31 * DAY_MS) },
    ]);
    expect(await add()).toMatchObject({ id: "new", duplicate: false });
    expect(created).toHaveLength(1);
  });
});

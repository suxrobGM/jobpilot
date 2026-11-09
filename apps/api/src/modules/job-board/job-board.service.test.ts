import type { PrismaClient } from "@/generated/prisma/client";
import { JobBoardService } from "./job-board.service";
import { describe, expect, it } from "bun:test";

const CATALOG = [
  { id: "b1", domain: "linkedin.com", name: "LinkedIn" },
  { id: "b2", domain: "indeed.com", name: "Indeed" },
];

function makeService() {
  const upserts: Record<string, unknown>[] = [];
  const links: Record<string, unknown>[] = [];
  const db = {
    jobBoard: {
      findUnique: async ({ where }: { where: { domain: string } }) =>
        CATALOG.find((row) => row.domain === where.domain) ?? null,
      // Mirrors `update: {}`: an existing row comes back untouched.
      upsert: async (args: { where: { domain: string } }) => {
        upserts.push(args);
        return CATALOG.find((row) => row.domain === args.where.domain) ?? { id: "new" };
      },
    },
    userJobBoard: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        links.push(data);
        return { id: "l2", board: { name: "LinkedIn", domain: "linkedin.com", searchUrl: null } };
      },
    },
  } as unknown as PrismaClient;
  return { svc: new JobBoardService(db), upserts, links };
}

describe("JobBoardService", () => {
  it("links by domain without touching the catalog row", async () => {
    const { svc, upserts, links } = makeService();
    await svc.create("u1", { domain: "linkedin.com", name: "ignored" });
    expect(upserts[0]).toMatchObject({ where: { domain: "linkedin.com" }, update: {} });
    expect(links[0]).toEqual({ userId: "u1", boardId: "b1" });
  });

  it("adds an unknown domain to the catalog unlisted, named by the domain when no name is given", async () => {
    const { svc, upserts, links } = makeService();
    await svc.create("u1", { domain: "jobs.example", searchUrl: "" });
    expect(upserts[0]).toMatchObject({
      create: { domain: "jobs.example", name: "jobs.example", searchUrl: null },
    });
    expect(links[0]).toEqual({ userId: "u1", boardId: "new" });
  });
});

describe("JobBoardService.resolve", () => {
  it("refuses a label that is no hostname, and stores no board for it", async () => {
    const { svc, upserts } = makeService();
    await expect(svc.resolve("indeed_priority")).rejects.toMatchObject({ status: 422 });
    expect(await svc.resolveId("Doxel first-party Lever")).toBeNull();
    expect(upserts).toEqual([]);
  });

  it("finds nothing for a board the catalog has never seen, without creating it", async () => {
    const { svc, upserts } = makeService();
    expect(await svc.find("naukri.com")).toBeNull();
    expect(upserts).toEqual([]);
  });
});

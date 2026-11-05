import type { PrismaClient } from "@/generated/prisma/client";
import { JobBoardService } from "./job-board.service";
import { describe, expect, it } from "bun:test";

const linkedin = { name: "LinkedIn", domain: "linkedin.com", searchUrl: "https://li" };

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
      findMany: async () => [{ id: "l1", board: linkedin }],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        links.push(data);
        return { id: "l2", board: linkedin };
      },
    },
  } as unknown as PrismaClient;
  return { svc: new JobBoardService(db), upserts, links };
}

describe("JobBoardService", () => {
  it("projects a link to its id plus the catalog fields", async () => {
    const { svc } = makeService();
    expect(await svc.list("u1")).toEqual([
      { id: "l1", name: "LinkedIn", domain: "linkedin.com", searchUrl: "https://li" },
    ]);
  });

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
  it("lands a URL or a bare name on the catalog row's exact domain", async () => {
    const { svc } = makeService();
    expect((await svc.resolve("https://www.LinkedIn.com/jobs/")).id).toBe("b1");
    expect((await svc.resolve("linkedin")).id).toBe("b1");
  });

  it("keeps a subdomain as its own board instead of folding it into the parent", async () => {
    const { svc, upserts } = makeService();
    expect((await svc.resolve("cisco.wd5.myworkdayjobs.com")).id).toBe("new");
    expect(upserts[0]).toMatchObject({ where: { domain: "cisco.wd5.myworkdayjobs.com" } });
  });

  it("adds an unknown bare name as its .com domain", async () => {
    const { svc, upserts } = makeService();
    await svc.resolve("naukri");
    expect(upserts[0]).toMatchObject({ create: { domain: "naukri.com", name: "naukri.com" } });
  });

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

// Link-by-domain, the wire projection, and patch semantics through JobBoardService with a fake
// Prisma and a fake CryptoService. The ownership 404 comes from findOwned, covered elsewhere.

import type { CryptoService } from "@/common/crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { JobBoardService } from "./job-board.service";
import { describe, expect, it } from "bun:test";

const linkedin = { id: "b1", name: "LinkedIn", domain: "linkedin.com", searchUrl: "https://li" };

function makeService(existingBoard: typeof linkedin | null = linkedin) {
  const upserts: Record<string, unknown>[] = [];
  const writes: Record<string, unknown>[] = [];
  const db = {
    jobBoard: {
      upsert: async (args: { create: Record<string, unknown> }) => {
        upserts.push(args);
        return { id: existingBoard?.id ?? "new" };
      },
    },
    userJobBoard: {
      findFirst: async () => ({ id: "l1" }),
      findMany: async () => [
        { id: "l1", jobBoardId: "b1", email: "me@x.io", password: "enc:pw", jobBoard: linkedin },
        { id: "l2", jobBoardId: "b2", email: null, password: null, jobBoard: existingBoard },
      ],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push(data);
        return {
          id: "l3",
          jobBoardId: "b1",
          email: data.email,
          password: data.password,
          jobBoard: linkedin,
        };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push(data);
        return {
          id: "l1",
          jobBoardId: "b1",
          email: data.email ?? "me@x.io",
          password: data.password ?? "enc:pw",
          jobBoard: linkedin,
        };
      },
    },
  } as unknown as PrismaClient;
  const crypto = {
    encryptField: async (_user: string, _ctx: string, value: string | null | undefined) =>
      value ? `enc:${value}` : value,
  } as unknown as CryptoService;
  return { svc: new JobBoardService(db, crypto), upserts, writes };
}

describe("JobBoardService", () => {
  it("projects a link to the catalog fields plus the login, never the password itself", async () => {
    const { svc } = makeService();
    const [first, second] = await svc.list("u1");
    expect(first).toEqual({
      id: "l1",
      jobBoardId: "b1",
      name: "LinkedIn",
      domain: "linkedin.com",
      searchUrl: "https://li",
      email: "me@x.io",
      hasPassword: true,
    });
    expect(second?.hasPassword).toBe(false);
    expect(first).not.toHaveProperty("password");
  });

  it("links by domain and stores only the login on the link", async () => {
    const { svc, upserts, writes } = makeService();
    await svc.create("u1", { domain: "linkedin.com", email: "me@x.io", password: "pw" });
    expect(upserts[0]).toMatchObject({ where: { domain: "linkedin.com" }, update: {} });
    expect(writes[0]).toEqual({
      userId: "u1",
      jobBoardId: "b1",
      email: "me@x.io",
      password: "enc:pw",
    });
  });

  it("adds an unknown domain to the catalog unlisted, named by the domain when no name is given", async () => {
    const { svc, upserts } = makeService(null);
    await svc.create("u1", { domain: "jobs.example", searchUrl: "" });
    expect(upserts[0]).toMatchObject({
      create: { domain: "jobs.example", name: "jobs.example", searchUrl: null },
    });
  });

  it("keeps an omitted field, clears a blank one, and encrypts a new password", async () => {
    const { svc, writes } = makeService();
    await svc.update("u1", "l1", { email: "" });
    expect(writes[0]).toEqual({ email: null, password: undefined });

    await svc.update("u1", "l1", { password: "next" });
    expect(writes[1]).toEqual({ email: undefined, password: "enc:next" });
  });
});

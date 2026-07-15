// addEvent note-append behavior against a fake Prisma - no database. Loading the service
// transitively loads `@/env`, satisfied by the local .env / ci.yml dummy env.
import type { PrismaClient } from "@/generated/prisma/client";
import { ApplicationService } from "./application.service";
import { describe, expect, it } from "bun:test";

interface Over {
  app?: { id: string } | null;
}

function makeDb(over: Over = {}) {
  const created: Record<string, unknown>[] = [];
  const db = {
    application: {
      findFirst: async () => over.app ?? null,
    },
    applicationEvent: {
      create: async (a: { data: Record<string, unknown> }) => {
        created.push(a.data);
        return {
          id: "ev-1",
          fromStatus: null,
          toStatus: null,
          source: null,
          createdAt: new Date(),
          ...a.data,
        };
      },
    },
  };
  return { db: db as unknown as PrismaClient, created };
}

describe("ApplicationService.addEvent", () => {
  it("appends a note event to an owned application", async () => {
    const { db, created } = makeDb({ app: { id: "a1" } });
    const svc = new ApplicationService(db);
    const event = await svc.addEvent("p1", "a1", { kind: "note", notes: "[interview-prep] sheet" });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      applicationId: "a1",
      kind: "note",
      note: "[interview-prep] sheet",
    });
    expect(event).toMatchObject({ id: "ev-1", kind: "note", note: "[interview-prep] sheet" });
  });

  it("throws a 404 when the application is not owned", async () => {
    const { db } = makeDb({ app: null });
    const svc = new ApplicationService(db);
    await expect(svc.addEvent("p1", "missing", { kind: "note", notes: "x" })).rejects.toThrow(
      /not found/i,
    );
  });
});

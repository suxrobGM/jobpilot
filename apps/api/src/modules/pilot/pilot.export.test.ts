// Fake-Prisma unit test for the journal NDJSON export: streams every entry, createdAt ascending,
// pulling in cursor batches. The fake returns small chunks so multi-batch cursor walking is exercised.
import type { PrismaClient } from "@/generated/prisma/client";
import { PilotService } from "./pilot.service";
import { makePush } from "./pilot.test-helpers";
import { describe, expect, it } from "bun:test";

const CHUNK = 2;

function row(id: string, minute: number): Record<string, unknown> {
  return {
    id,
    profileId: "p1",
    cycleId: null,
    kind: "action",
    summary: `entry ${id}`,
    detail: "{}",
    subjectType: null,
    subjectId: null,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, minute)),
  };
}

/** Fake Prisma paging `pilotJournalEntry` in CHUNK-sized batches keyed by the id cursor. */
function makeDb(rows: Record<string, unknown>[]) {
  return {
    pilotJournalEntry: {
      findMany: async (a: { cursor?: { id: string }; skip?: number }) => {
        const start = a.cursor ? rows.findIndex((r) => r.id === a.cursor?.id) + 1 : 0;
        return rows.slice(start, start + CHUNK);
      },
    },
  };
}

function service(rows: Record<string, unknown>[]) {
  const db = makeDb(rows) as unknown as PrismaClient;
  return new PilotService(db, makePush({ pushes: [] }));
}

describe("PilotService journal export", () => {
  it("streams all entries as ordered NDJSON across batches", async () => {
    const rows = [row("a", 0), row("b", 1), row("c", 2), row("d", 3), row("e", 4)];
    const res = service(rows).streamJournalExport("p1");

    expect(res.headers.get("content-type")).toBe("application/x-ndjson");
    expect(res.headers.get("content-disposition")).toContain("pilot-journal.ndjson");

    const text = await res.text();
    const lines = text.trim().split("\n");
    expect(lines).toHaveLength(5);

    const parsed = lines.map((l) => JSON.parse(l) as { id: string; summary: string });
    expect(parsed.map((p) => p.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(parsed[0].summary).toBe("entry a");
  });

  it("emits nothing for an empty journal", async () => {
    const res = service([]).streamJournalExport("p1");
    const text = await res.text();
    expect(text).toBe("");
  });
});

import { agendaClaimFieldsSchema, agendaResponseSchema } from "@jobpilot/contracts/pilot";
import { DATE_KEYS, reviveJsonDates, toInputJson } from "./json";
import { describe, expect, it } from "bun:test";

type ZodNode = { _zod?: { def?: Record<string, unknown> } };

function unwrap(schema: ZodNode): ZodNode {
  const def = schema?._zod?.def as { type?: string; innerType?: ZodNode } | undefined;
  if (def && (def.type === "nullable" || def.type === "optional" || def.type === "default")) {
    return unwrap(def.innerType as ZodNode);
  }
  return schema;
}

function childrenOf(def: Record<string, unknown>): ZodNode[] {
  switch (def.type) {
    case "object":
      return Object.values(def.shape as Record<string, ZodNode>);
    case "array":
      return [def.element as ZodNode];
    case "union":
      return def.options as ZodNode[];
    case "intersection":
      return [def.left as ZodNode, def.right as ZodNode];
    case "record":
      return [def.valueType as ZodNode];
    case "nullable":
    case "optional":
    case "default":
      return [def.innerType as ZodNode];
    default:
      return [];
  }
}

function dateKeysOf(schema: ZodNode, found = new Set<string>(), seen = new Set<ZodNode>()) {
  const def = schema?._zod?.def;
  if (!def || seen.has(schema)) {
    return found;
  }

  seen.add(schema);

  if (def.type === "object") {
    for (const [key, child] of Object.entries(def.shape as Record<string, ZodNode>)) {
      if (unwrap(child)?._zod?.def?.type === "date") found.add(key);
    }
  }

  for (const child of childrenOf(def)) {
    dateKeysOf(child, found, seen);
  }
  return found;
}

describe("reviveJsonDates", () => {
  it("covers every date key the agenda and claim schemas declare", () => {
    const declared = dateKeysOf(agendaResponseSchema as unknown as ZodNode);
    dateKeysOf(agendaClaimFieldsSchema as unknown as ZodNode, declared);

    expect([...declared].filter((key) => !DATE_KEYS.has(key))).toEqual([]);
  });

  it("restores dates through a JSON round trip", () => {
    const synced = new Date("2026-09-08T08:07:00.000Z");
    const stored = JSON.parse(
      JSON.stringify(toInputJson({ payload: { lastSyncedAt: synced, unreadCount: 2 } })),
    );

    expect(reviveJsonDates(stored)).toEqual({ payload: { lastSyncedAt: synced, unreadCount: 2 } });
  });
});

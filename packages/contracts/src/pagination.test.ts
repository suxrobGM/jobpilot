import { cursorPage, pageSlice, paginate, paginationQuerySchema, queryText } from "./pagination";
import { describe, expect, it } from "bun:test";

describe("pageSlice", () => {
  it("turns a 1-based page into a Prisma offset", () => {
    expect(pageSlice({ page: 1, limit: 25 })).toEqual({ skip: 0, take: 25 });
    expect(pageSlice({ page: 3, limit: 20 })).toEqual({ skip: 40, take: 20 });
  });
});

describe("paginate", () => {
  it("derives totalPages, rounding a partial last page up", () => {
    expect(paginate([], { page: 1, limit: 20 }, 41).pagination).toEqual({
      page: 1,
      limit: 20,
      total: 41,
      totalPages: 3,
    });
  });

  it("reports zero pages for an empty collection", () => {
    expect(paginate([], { page: 1, limit: 20 }, 0).pagination.totalPages).toBe(0);
  });
});

describe("cursorPage", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("trims the probe row and resumes from the last kept id", () => {
    expect(cursorPage(rows, 2)).toEqual({ items: [{ id: "a" }, { id: "b" }], nextCursor: "b" });
  });

  it("ends the walk when the probe row never came back", () => {
    expect(cursorPage(rows, 3)).toEqual({ items: rows, nextCursor: null });
    expect(cursorPage([], 3)).toEqual({ items: [], nextCursor: null });
  });
});

describe("paginationQuerySchema", () => {
  it("coerces query strings and applies the defaults", () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, limit: 25 });
    expect(paginationQuerySchema.parse({ page: "3", limit: "50" })).toEqual({ page: 3, limit: 50 });
  });

  it("rejects a limit past the cap, so no caller can ask for the whole table", () => {
    expect(paginationQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  });
});

describe("queryText", () => {
  it("rejoins a value Elysia split on its commas", () => {
    expect(queryText.parse(["Engineer", " Platform"])).toBe("Engineer, Platform");
  });
});

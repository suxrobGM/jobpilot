// `owned.ts` imports only `./http.error` (env/Prisma-free), so the closure form lets us test
// ownership-or-404 with a fake `find` - no real Prisma.

import { HttpError } from "./http.error";
import { findOwned } from "./owned";
import { describe, expect, it } from "bun:test";

describe("findOwned", () => {
  it("returns the row when the finder yields one", async () => {
    const row = { id: "abc", userId: "p1" };
    const found = await findOwned(async () => row, { id: "abc", userId: "p1" }, "Credential");
    expect(found).toBe(row);
  });

  it("throws a 404 HttpError labelled with the entity when nothing is found", async () => {
    const call = findOwned(async () => null, { id: "missing" }, "Feed");
    await expect(call).rejects.toThrow("Feed not found");
    await expect(call).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    await expect(call).rejects.toBeInstanceOf(HttpError);
  });
});

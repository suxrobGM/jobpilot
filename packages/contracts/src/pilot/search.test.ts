import { createPilotSearchSchema, updatePilotSearchSchema } from "./search";
import { describe, expect, it } from "bun:test";

describe("updatePilotSearchSchema", () => {
  it("leaves omitted fields out, so a one-field patch can't erase the reason", () => {
    expect(updatePilotSearchSchema.parse({ board: "linkedin.com" })).toEqual({
      board: "linkedin.com",
    });
  });
});

describe("createPilotSearchSchema", () => {
  it("defaults the reason for a new search", () => {
    expect(createPilotSearchSchema.parse({ query: "q" }).reason).toBe("");
  });
});

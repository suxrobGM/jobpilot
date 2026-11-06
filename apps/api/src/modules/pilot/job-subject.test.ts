import { parseJobSubject } from "./job-subject";
import { describe, expect, it } from "bun:test";

describe("parseJobSubject", () => {
  it("splits on the first colon, so job keys may contain colons", () => {
    expect(parseJobSubject("c1:a:b")).toEqual({ feedId: "c1", key: "a:b" });
  });

  it("rejects a subject missing either half", () => {
    expect(() => parseJobSubject(":j1")).toThrow();
    expect(() => parseJobSubject("c1:")).toThrow();
  });
});

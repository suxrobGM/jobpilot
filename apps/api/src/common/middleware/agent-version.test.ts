import { isOutdatedAgent } from "./agent-version";
import { describe, expect, it } from "bun:test";

describe("isOutdatedAgent", () => {
  it.each([
    [undefined, true],
    ["", true],
    ["garbage", true],
    ["2.4.1", true],
    ["1.9.9", true],
    ["2.4.2", false],
    ["2.4.10", false],
    ["2.5.0", false],
    ["3.0.0-beta", false],
  ])("%p is outdated: %p", (version, outdated) => {
    expect(isOutdatedAgent(version)).toBe(outdated);
  });
});

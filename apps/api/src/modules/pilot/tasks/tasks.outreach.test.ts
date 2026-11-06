import { hasTaskType } from "./builders";
import { service } from "./fakes";
import { describe, expect, it } from "bun:test";

describe("TaskListService promotion cadence", () => {
  const config = { promotion: { platforms: [{ platform: "hn", postEveryDays: 30 }] } };

  it("drafts for a platform with no post yet, and not after a recent one", async () => {
    const first = await service({ config }).refresh("p1");
    expect(hasTaskType(first, "promotion.draft")).toBe(true);

    const recent = await service({
      config,
      platformPosts: [{ platform: "hn", createdAt: new Date() }],
    }).refresh("p1");
    expect(hasTaskType(recent, "promotion.draft")).toBe(false);
  });
});

import type { PrismaClient } from "@/generated/prisma/client";
import { StepService } from "./step.service";
import { describe, expect, it } from "bun:test";

function service(finishedAt: Date | null = null) {
  const db = { pilotRun: { findFirst: async () => ({ finishedAt }) } };
  return new StepService(db as unknown as PrismaClient);
}

const at = "2026-11-06T12:00:00.000Z";

describe("StepService", () => {
  it("keeps the last 100 steps of a run", async () => {
    const steps = service();
    for (let batch = 0; batch < 3; batch++) {
      const labels = Array.from({ length: 50 }, (_, i) => ({
        at,
        label: `step ${batch * 50 + i}`,
      }));
      await steps.append("u1", "r1", labels);
    }
    const kept = await steps.list("u1", "r1");
    expect(kept).toHaveLength(100);
    expect(kept[0]).toMatchObject({ id: 51, label: "step 50" });
    expect(kept[0].at).toBeInstanceOf(Date);
  });

  it("rejects steps for a finished run", async () => {
    await expect(
      service(new Date()).append("u1", "r1", [{ at, label: "x" }]),
    ).rejects.toMatchObject({
      status: 409,
    });
  });
});

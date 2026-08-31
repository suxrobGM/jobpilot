import { APPLIED_AT, setup } from "./job.service.test-helpers";
import { describe, expect, it } from "bun:test";

describe("CampaignJobService queued rows", () => {
  it("promotes a scored pasted link from queued to pending", async () => {
    const state = setup();
    state.setStatus("queued");
    const patched = await state.service.patchJob("u1", "c1", "j1", {
      status: "pending",
      title: "Staff Engineer",
      company: "Acme",
    });
    expect(patched).toMatchObject({ status: "pending", title: "Staff Engineer", company: "Acme" });
  });

  it("refuses to skip the score pass by approving a queued row outright", async () => {
    const state = setup();
    state.setStatus("queued");
    await expect(state.service.patchJob("u1", "c1", "j1", { status: "approved" })).rejects.toThrow(
      "cannot transition from queued to approved",
    );
  });
});

// Both routes into `applying` have to refuse a duplicate: the agent's own `/applied/check` call is
// advice it can skip, and by the browser step it is already too late.
describe("CampaignJobService duplicate apply guard", () => {
  const EXISTING = {
    id: "app-1",
    url: "https://example.test/jobs/1",
    title: "Engineer",
    company: "Acme",
    appliedAt: new Date(APPLIED_AT),
    status: "applied",
  };

  it("blocks the campaign PATCH into applying", async () => {
    const state = setup();
    state.setStatus("approved");
    state.setApplication(EXISTING);

    await expect(state.service.patchJob("u1", "c1", "j1", { status: "applying" })).rejects.toThrow(
      /Already applied/,
    );
    expect(state.job.status).toBe("skipped");
  });

  it("blocks the pilot claim", async () => {
    const state = setup();
    state.setStatus("approved");
    state.setApplication(EXISTING);

    await expect(state.service.claimJobForApply("u1", "c1", "j1")).rejects.toThrow(
      /Already applied/,
    );
    expect(state.job.status).toBe("skipped");
  });

  // The refusal rolls its own transaction back, so without a separate write the job stays
  // `approved` and the next agenda offers the same duplicate again.
  it("records the refused job as skipped with the duplicate reason", async () => {
    const state = setup();
    state.setStatus("approved");
    state.setApplication(EXISTING);

    await expect(state.service.claimJobForApply("u1", "c1", "j1")).rejects.toThrow(
      /Already applied/,
    );

    expect(state.job).toMatchObject({ status: "skipped", skipReason: "Already applied (url)" });
  });

  it("still lets a job through when nothing matches", async () => {
    const state = setup();
    state.setStatus("approved");

    const patched = await state.service.patchJob("u1", "c1", "j1", { status: "applying" });

    expect(patched).toMatchObject({ status: "applying" });
  });

  it("claims an approved job and returns the row the write produced", async () => {
    const state = setup();
    state.setStatus("approved");

    const claimed = await state.service.claimJobForApply("u1", "c1", "j1");

    expect(claimed).toMatchObject({ key: "j1", status: "applying" });
    expect(state.job.status).toBe("applying");
  });

  it("refuses a claim the moment the row is no longer approved", async () => {
    const state = setup();
    state.setStatus("pending");

    await expect(state.service.claimJobForApply("u1", "c1", "j1")).rejects.toThrow(
      "Job is no longer approved.",
    );
  });
});

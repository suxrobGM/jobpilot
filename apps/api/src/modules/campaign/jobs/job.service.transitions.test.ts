import { INTERRUPTED_REASON } from "@jobpilot/contracts/campaign";
import { APPLIED_AT, setup } from "./fakes";
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

  // The refusal rolls its own transaction back, so without a separate write the job stays
  // `approved` and the next task list offers the same duplicate again.
  it("records the refused job as skipped with the duplicate reason", async () => {
    const state = setup();
    state.setStatus("approved");
    state.setApplication(EXISTING);

    await expect(state.startApplying()).rejects.toThrow(/recorded as skipped/);

    expect(state.job).toMatchObject({ status: "skipped", skipReason: "Already applied (url)" });
  });

  it("still lets a job through when nothing matches", async () => {
    const state = setup();
    state.setStatus("approved");

    const patched = await state.service.patchJob("u1", "c1", "j1", { status: "applying" });

    expect(patched).toMatchObject({ status: "applying" });
  });

  it("starts applying to an approved job and returns the row the write produced", async () => {
    const state = setup();
    state.setStatus("approved");

    const started = await state.startApplying();

    expect(started).toMatchObject({ key: "j1", status: "applying" });
    expect(state.job.status).toBe("applying");
  });

  it("refuses to start the moment the row is no longer approved", async () => {
    const state = setup();
    state.setStatus("pending");

    await expect(state.startApplying()).rejects.toThrow("Job is no longer approved.");
  });
});

// A stamped job may already be with the employer. Recovery parks it for a human; PATCH is the
// other door into the apply queue and has to be locked too, or the guard is decorative.
describe("CampaignJobService submit-attempt guard", () => {
  it("refuses to re-approve a job that may already have been submitted", async () => {
    const state = setup();
    state.setSubmitAttempted(new Date());

    await expect(state.service.patchJob("u1", "c1", "j1", { status: "approved" })).rejects.toThrow(
      /may already have been submitted/,
    );
  });

  it("still re-approves an interrupted job that never reached the submit", async () => {
    const state = setup();

    const patched = await state.service.patchJob("u1", "c1", "j1", { status: "approved" });

    expect(patched).toMatchObject({ status: "approved" });
  });
});

// Recovery parks every interrupted apply, and the agent stamps the submit almost never - so a
// guard that keys off the stamp alone leaves the entire parked population unprotected.
describe("CampaignJobService recovery hold", () => {
  function held(state: ReturnType<typeof setup>) {
    state.setStatus("needs_user");
    state.setSkipReason(INTERRUPTED_REASON);
  }

  it("refuses to re-apply a held job even though nothing marked the submit", async () => {
    const state = setup();
    held(state);

    await expect(state.service.patchJob("u1", "c1", "j1", { status: "approved" })).rejects.toThrow(
      /may or may not have been submitted/,
    );
  });

  it("refuses the resume path too, not just the bulk re-apply button", async () => {
    const state = setup();
    held(state);

    await expect(state.service.patchJob("u1", "c1", "j1", { status: "applying" })).rejects.toThrow(
      /may or may not have been submitted/,
    );
  });

  // A slow apply outliving its run's lifetime is parked while still running; letting it submit is
  // the duplicate the hold exists to prevent, with the user mid-question about it.
  it("refuses a submit attempt on a held job", async () => {
    const state = setup();
    held(state);

    await expect(state.service.markSubmitAttempt("u1", "c1", "j1")).rejects.toThrow(
      /may or may not have been submitted/,
    );
  });

  it("still lets an ordinary needs_user job resume its submit", async () => {
    const state = setup();
    state.setStatus("needs_user");
    state.setSkipReason("Waiting on a 2FA code.");

    await expect(state.service.markSubmitAttempt("u1", "c1", "j1")).resolves.toBeDefined();
  });

  it("releases the hold only on the user's explicit confirmation, clearing the stamp with it", async () => {
    const state = setup();
    held(state);
    state.setSubmitAttempted(new Date());

    const patched = await state.service.patchJob("u1", "c1", "j1", {
      status: "approved",
      confirmNotSubmitted: true,
    });

    expect(patched).toMatchObject({ status: "approved" });
    // Left in place, the stamp would 409 the very apply this confirmation just authorised.
    expect(state.job.submitAttemptedAt).toBeNull();
  });

  it("rejects the confirmation on a job that was never held", async () => {
    const state = setup();

    await expect(
      state.service.patchJob("u1", "c1", "j1", { status: "approved", confirmNotSubmitted: true }),
    ).rejects.toThrow(/not waiting on a submitted-or-not answer/);
  });
});

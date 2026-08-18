import {
  AUTO_REJECTION_FROM_STATUSES,
  AUTO_REJECTION_MIN_CONFIDENCE,
  type AutoRejectionInput,
  isAutoRejection,
  needsHumanReview,
} from "./auto-rejection";
import { describe, expect, it } from "bun:test";

const rejection = {
  classification: "rejected",
  reviewStatus: "auto",
  matchedAppId: "1cf2c0b6-2f0b-4a5e-9c1e-6a51f2f9b7aa",
  confidence: 0.97,
} satisfies AutoRejectionInput;

describe("isAutoRejection", () => {
  it("applies a confident, matched rejection", () => {
    expect(isAutoRejection(rejection)).toBe(true);
  });

  it("honours an explicit appliedStatus over the classification map", () => {
    expect(isAutoRejection({ ...rejection, classification: "irrelevant" })).toBe(false);
    expect(
      isAutoRejection({ ...rejection, classification: "irrelevant", appliedStatus: "rejected" }),
    ).toBe(true);
  });

  it("never auto-applies a classification that needs a reply", () => {
    for (const classification of ["interviewing", "offer"] as const) {
      expect(isAutoRejection({ ...rejection, classification })).toBe(false);
    }
  });

  it("requires reviewStatus auto - pending stays queued for the human", () => {
    for (const reviewStatus of ["pending", "approved", "denied", undefined] as const) {
      expect(isAutoRejection({ ...rejection, reviewStatus })).toBe(false);
    }
  });

  it("requires a matched application", () => {
    expect(isAutoRejection({ ...rejection, matchedAppId: null })).toBe(false);
    expect(isAutoRejection({ ...rejection, matchedAppId: undefined })).toBe(false);
  });

  it("rejects confidence below the threshold but allows it absent", () => {
    expect(isAutoRejection({ ...rejection, confidence: AUTO_REJECTION_MIN_CONFIDENCE })).toBe(true);
    expect(isAutoRejection({ ...rejection, confidence: 0.94 })).toBe(false);
    expect(isAutoRejection({ ...rejection, confidence: undefined })).toBe(true);
  });
});

describe("AUTO_REJECTION_FROM_STATUSES", () => {
  it("excludes terminal and hand-set outcomes so the write stays idempotent", () => {
    for (const status of ["rejected", "withdrawn", "offer"]) {
      expect(AUTO_REJECTION_FROM_STATUSES).not.toContain(status);
    }
  });

  it("covers every live status a rejection can arrive against", () => {
    expect([...AUTO_REJECTION_FROM_STATUSES]).toEqual(["applied", "screening", "interviewing"]);
  });
});

describe("needsHumanReview", () => {
  it("queues an interview invite even when the scanner asked for auto", () => {
    expect(needsHumanReview({ classification: "interviewing", reviewStatus: "auto" })).toBe(true);
  });

  it("queues an offer", () => {
    expect(needsHumanReview({ classification: "offer", reviewStatus: "auto" })).toBe(true);
  });

  it("leaves rejections and noise to the auto gate", () => {
    expect(needsHumanReview(rejection)).toBe(false);
    expect(needsHumanReview({ classification: "irrelevant" })).toBe(false);
  });

  it("honours an explicit appliedStatus over the classification map", () => {
    expect(needsHumanReview({ classification: "rejected", appliedStatus: "offer" })).toBe(true);
  });
});

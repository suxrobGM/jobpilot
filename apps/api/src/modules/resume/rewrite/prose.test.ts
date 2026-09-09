import type { ResumeData } from "@jobpilot/contracts/resume";
import { buildCorpus } from "./facts";
import { base } from "./fakes";
import { validateHeadline, validateSummary } from "./prose";
import { describe, expect, it } from "bun:test";

const summaryViolations = (data: ResumeData, summary: string) =>
  validateSummary(data.summary ?? "", summary, buildCorpus(data));

const headlineViolations = (data: ResumeData, headline: string) =>
  validateHeadline(headline, buildCorpus(data));

describe("validateSummary", () => {
  it("accepts a light edit that swaps one sentence", () => {
    const violations = summaryViolations(
      base(),
      "Machine learning engineer who takes models from research question to production service. Trained in computer vision and multimodal learning, with published work in medical imaging, on top of nine years of building software that people depend on. Recent work is clinical NLP under HIPAA.",
    );

    expect(violations).toEqual([]);
  });

  it("refuses a rewrite that keeps little of the base wording", () => {
    const violations = summaryViolations(
      base(),
      "Data scientist with nine years building production ML and analytics systems, including predictive models over millions of records and statistical forecasting. Applied-math background.",
    );

    expect(violations.some((v) => v.includes("% of the base summary"))).toBe(true);
  });

  it("names every stock phrase it finds", () => {
    const violations = summaryViolations(
      base(),
      "Machine learning engineer comfortable with PyTorch who enjoys solving practical problems and picking up new techniques quickly.",
    );

    const stock = violations.find((v) => v.includes("stock phrasing")) ?? "";
    expect(stock).toContain("comfortable with");
    expect(stock).toContain("enjoys");
    expect(stock).toContain("picking up");
  });

  it("refuses a number the resume never states", () => {
    const violations = summaryViolations(
      base(),
      "Machine learning engineer who takes models from research question to production service across 12 launches. Trained in computer vision and multimodal learning, with published work in medical imaging, on top of nine years of building software.",
    );

    expect(violations.some((v) => v.includes("12"))).toBe(true);
  });

  it("refuses tech the resume never mentions", () => {
    const violations = summaryViolations(
      base(),
      "Machine learning engineer who takes models from research question to production service on GCP. Trained in computer vision and multimodal learning, with published work in medical imaging, on top of nine years of building software.",
    );

    expect(violations.some((v) => v.includes("GCP"))).toBe(true);
  });

  it("caps the summary at three sentences", () => {
    const violations = summaryViolations(
      base(),
      "Machine learning engineer. Takes models from research question to production service. Trained in computer vision and multimodal learning with published work in medical imaging. Nine years of building software that people depend on.",
    );

    expect(violations.some((v) => v.includes("4 sentences"))).toBe(true);
  });

  it("lets a stub summary be rewritten freely", () => {
    const stub = { ...base(), summary: "Engineer." };

    expect(summaryViolations(stub, "Machine learning engineer focused on clinical NLP.")).toEqual(
      [],
    );
  });
});

describe("validateHeadline", () => {
  it("accepts a plain title", () => {
    expect(headlineViolations(base(), "Senior Machine Learning Engineer")).toEqual([]);
  });

  it("refuses stock phrasing and unknown tech", () => {
    const violations = headlineViolations(base(), "Seasoned GCP Engineer");

    expect(violations).toHaveLength(2);
  });
});

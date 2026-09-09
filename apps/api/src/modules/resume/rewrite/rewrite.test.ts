import { buildCorpus } from "./facts";
import { base, NLP_BULLET, PIPELINE_BULLET } from "./fakes";
import { validateRewrites } from "./rewrite";
import { describe, expect, it } from "bun:test";

function rewrite(entryIndex: number, original: string, tailored: string) {
  const data = base();
  return validateRewrites(
    data,
    [{ entryIndex, bullets: [{ original, tailored }] }],
    buildCorpus(data),
  );
}

describe("validateRewrites", () => {
  it("accepts a reword that keeps every fact and only changes the lead", () => {
    const result = rewrite(
      0,
      NLP_BULLET,
      "Clinical NLP pipeline extracting symptoms, medications, and care events from free-text notes; 0.90 F1.",
    );

    expect(result.violations).toEqual([]);
    expect(result.audit[0].bullets[0]).toEqual({
      original: NLP_BULLET,
      tailored:
        "Clinical NLP pipeline extracting symptoms, medications, and care events from free-text notes; 0.90 F1.",
    });
  });

  it("refuses a reword that drops the tech the original named", () => {
    const result = rewrite(
      1,
      PIPELINE_BULLET,
      "Built a real-time feature and automated retraining pipeline for forecasting models, running nightly.",
    );

    expect(result.violations[0]).toContain("drops tech");
    expect(result.violations[0]).toContain("SignalR");
  });

  it("refuses a reword that drops a number the original stated", () => {
    const result = rewrite(
      0,
      NLP_BULLET,
      "NLP pipeline extracting symptoms, medications, and care events from clinical notes with F1 measured.",
    );

    expect(result.violations[0]).toContain("drops number");
  });

  it("refuses a reword that adds a clause", () => {
    const result = rewrite(
      0,
      NLP_BULLET,
      `Biomedical ${NLP_BULLET} Results fed a clinical decision-support workflow used by the care team daily.`,
    );

    expect(result.violations[0]).toContain("grows from");
  });

  it("refuses stock phrasing", () => {
    const result = rewrite(
      0,
      NLP_BULLET,
      "Hands-on NLP pipeline extracting symptoms, medications, and care events from clinical notes; 0.90 F1.",
    );

    expect(result.violations[0]).toContain("stock phrasing");
    expect(result.violations[0]).toContain("hands-on");
  });

  it("rejects tech the resume never mentions instead of flagging it", () => {
    const result = rewrite(
      0,
      NLP_BULLET,
      "NLP pipeline on GCP extracting symptoms, medications, and care events from clinical notes; 0.90 F1.",
    );

    expect(result.violations[0]).toContain("GCP");
  });

  it("accepts tech attested elsewhere in the resume", () => {
    const result = rewrite(
      0,
      NLP_BULLET,
      "HIPAA NLP pipeline extracting symptoms, medications, and care events from clinical notes; 0.90 F1.",
    );

    expect(result.violations).toEqual([]);
  });
});

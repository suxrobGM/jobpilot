// The public job index is built from the brief, so a garbled or empty one silently loses the job.

import { addJobSchema, patchJobSchema } from "./feed";
import { describe, expect, it } from "bun:test";

const job = (brief?: unknown) => ({
  key: "acme-engineer-1",
  title: "Engineer",
  company: "Acme",
  url: "https://acme.example/jobs/1",
  ...(brief !== undefined && { brief }),
});

const brief = { skills: ["Go"] };

describe("job brief contract", () => {
  it("accepts a JSON object", () => {
    expect(addJobSchema.parse(job(brief)).brief).toEqual(brief);
  });

  it("drops an empty brief instead of storing it", () => {
    expect(addJobSchema.parse(job({})).brief).toBeUndefined();
  });

  it("rejects a brief that is not a JSON object", () => {
    expect(addJobSchema.safeParse(job(JSON.stringify(brief))).success).toBe(false);
    expect(addJobSchema.safeParse(job(["Go"])).success).toBe(false);
    expect(addJobSchema.safeParse(job("Go")).success).toBe(false);
  });

  // Undefined leaves the stored brief alone; an explicit null is the caller clearing it.
  it("distinguishes an omitted brief from an explicit null on patch", () => {
    expect(patchJobSchema.parse({}).brief).toBeUndefined();
    expect(patchJobSchema.parse({ brief: null }).brief).toBeNull();
    expect(patchJobSchema.parse({ brief: {} }).brief).toBeUndefined();
  });
});

import { buildListingDraft, type ListingSourceJob } from "./listing-draft";
import { describe, expect, it } from "bun:test";

const digest = JSON.stringify({
  skills: ["TypeScript", "React"],
  descriptionExcerpt: "Build things.",
});

const job = (overrides: Partial<ListingSourceJob> = {}): ListingSourceJob => ({
  title: "Senior Software Engineer",
  company: "Acme Inc.",
  url: "https://example.com/jobs/1?utm_source=x",
  location: "New York, NY",
  salary: "$180k",
  type: "Full-time",
  board: "linkedin.com",
  description: "A long description.",
  digest,
  ...overrides,
});

describe("quality gate", () => {
  it("publishes a job with title, company, url and parsed digest skills", () => {
    expect(buildListingDraft(job())).not.toBeNull();
  });

  it("rejects a search-results stub with no digest", () => {
    expect(buildListingDraft(job({ digest: null }))).toBeNull();
  });

  it("rejects a digest whose skills list is empty", () => {
    expect(buildListingDraft(job({ digest: JSON.stringify({ skills: [] }) }))).toBeNull();
  });

  it("rejects a queued row even when it is otherwise publishable", () => {
    expect(buildListingDraft(job({ status: "queued" }))).toBeNull();
  });

  it("rejects malformed digest JSON instead of throwing", () => {
    expect(buildListingDraft(job({ digest: "{not json" }))).toBeNull();
  });

  it.each([["title"], ["company"], ["url"]] as const)("rejects a blank %s", (field) => {
    expect(buildListingDraft(job({ [field]: "   " }))).toBeNull();
  });
});

describe("projection", () => {
  it("canonicalizes the url and carries only digest fields", () => {
    const draft = buildListingDraft(job());
    expect(draft?.url).toBe("https://example.com/jobs/1");
    expect(draft?.skills).toEqual(["TypeScript", "React"]);
    expect(draft?.salary).toBe("$180k");
    expect(draft?.employmentType).toBe("Full-time");
    expect(draft?.descriptionExcerpt).toBe("Build things.");
  });

  it("infers remote from the location text", () => {
    expect(buildListingDraft(job({ location: "Remote - US" }))?.remote).toBe(true);
    expect(buildListingDraft(job())?.remote).toBe(false);
  });

  it("honours an explicit remote flag in the digest", () => {
    const raw = JSON.stringify({ skills: ["Go"], remote: true });
    expect(buildListingDraft(job({ digest: raw, location: "New York, NY" }))?.remote).toBe(true);
  });

  it("falls back to the job description when the digest has no excerpt", () => {
    const raw = JSON.stringify({ skills: ["Go"] });
    expect(buildListingDraft(job({ digest: raw }))?.descriptionExcerpt).toBe("A long description.");
  });

  it("truncates a runaway excerpt", () => {
    const raw = JSON.stringify({ skills: ["Go"], descriptionExcerpt: "x".repeat(900) });
    const excerpt = buildListingDraft(job({ digest: raw }))?.descriptionExcerpt ?? "";
    expect(excerpt.length).toBeLessThanOrEqual(601);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  it("carries the digest's requirements, responsibilities and years of experience", () => {
    const raw = JSON.stringify({
      skills: ["Go"],
      requirements: ["  5 years of Go  ", "", "Kubernetes"],
      responsibilities: ["Ship services"],
      yearsExperience: 5,
    });
    const draft = buildListingDraft(job({ digest: raw }));
    expect(draft?.requirements).toEqual(["5 years of Go", "Kubernetes"]);
    expect(draft?.responsibilities).toEqual(["Ship services"]);
    expect(draft?.yearsExperience).toBe(5);
  });

  it("defaults the digest bullets to empty rather than undefined", () => {
    const draft = buildListingDraft(job({ digest: JSON.stringify({ skills: ["Go"] }) }));
    expect(draft?.requirements).toEqual([]);
    expect(draft?.responsibilities).toEqual([]);
    expect(draft?.yearsExperience).toBeNull();
  });

  it("caps how many bullets and how long each one can be", () => {
    const raw = JSON.stringify({
      skills: ["Go"],
      requirements: Array.from({ length: 30 }, (_, i) => `req ${i}`),
      responsibilities: ["y".repeat(500)],
    });
    const draft = buildListingDraft(job({ digest: raw }));
    expect(draft?.requirements).toHaveLength(12);
    expect(draft?.responsibilities[0]?.length).toBeLessThanOrEqual(301);
    expect(draft?.responsibilities[0]?.endsWith("…")).toBe(true);
  });

  it.each([[0], [-3], [80]])("drops an out-of-range yearsExperience of %p", (years) => {
    const raw = JSON.stringify({ skills: ["Go"], yearsExperience: years });
    expect(buildListingDraft(job({ digest: raw }))?.yearsExperience).toBeNull();
  });

  it("gives two reposts of one posting the same dedupe key but different source urls", () => {
    const a = buildListingDraft(job({ url: "https://linkedin.com/jobs/1", board: "linkedin.com" }));
    const b = buildListingDraft(
      job({ url: "https://indeed.com/viewjob?jk=9", board: "indeed.com" }),
    );
    expect(a?.dedupeKey).toBe(b?.dedupeKey as string);
    expect(a?.slug).toBe(b?.slug as string);
    expect(a?.url).not.toBe(b?.url as string);
  });
});

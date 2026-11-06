import { buildListingDraft, type ListingSourceJob } from "./listing-draft";
import { describe, expect, it } from "bun:test";

const brief = {
  skills: ["TypeScript", "React"],
  descriptionExcerpt: "Build things.",
};

const job = (overrides: Partial<ListingSourceJob> = {}): ListingSourceJob => ({
  title: "Senior Software Engineer",
  company: "Acme Inc.",
  url: "https://example.com/jobs/1?utm_source=x",
  location: "New York, NY",
  salary: "$180k",
  employmentType: "Full-time",
  boardId: "linkedin-board",
  description: "A long description.",
  brief,
  ...overrides,
});

describe("quality gate", () => {
  it("publishes a job with title, company, url and parsed brief skills", () => {
    expect(buildListingDraft(job())).not.toBeNull();
  });

  it("rejects a search-results stub with no brief", () => {
    expect(buildListingDraft(job({ brief: null }))).toBeNull();
  });

  it("rejects a brief whose skills list is empty", () => {
    expect(buildListingDraft(job({ brief: { skills: [] } }))).toBeNull();
  });

  it("rejects a queued row even when it is otherwise publishable", () => {
    expect(buildListingDraft(job({ status: "queued" }))).toBeNull();
  });

  it("rejects a brief that is not an object instead of throwing", () => {
    expect(buildListingDraft(job({ brief: ["Go"] }))).toBeNull();
  });

  it.each([["title"], ["company"], ["url"]] as const)("rejects a blank %s", (field) => {
    expect(buildListingDraft(job({ [field]: "   " }))).toBeNull();
  });
});

describe("projection", () => {
  it("canonicalizes the url and carries only brief fields", () => {
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

  it("honours an explicit remote flag in the brief", () => {
    const raw = { skills: ["Go"], remote: true };
    expect(buildListingDraft(job({ brief: raw, location: "New York, NY" }))?.remote).toBe(true);
  });

  it("falls back to the job description when the brief has no excerpt", () => {
    const raw = { skills: ["Go"] };
    expect(buildListingDraft(job({ brief: raw }))?.descriptionExcerpt).toBe("A long description.");
  });

  it("truncates a runaway excerpt", () => {
    const raw = { skills: ["Go"], descriptionExcerpt: "x".repeat(900) };
    const excerpt = buildListingDraft(job({ brief: raw }))?.descriptionExcerpt ?? "";
    expect(excerpt.length).toBeLessThanOrEqual(601);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  it("carries the brief's requirements, responsibilities and years of experience", () => {
    const raw = {
      skills: ["Go"],
      requirements: ["  5 years of Go  ", "", "Kubernetes"],
      responsibilities: ["Ship services"],
      yearsExperience: 5,
    };
    const draft = buildListingDraft(job({ brief: raw }));
    expect(draft?.requirements).toEqual(["5 years of Go", "Kubernetes"]);
    expect(draft?.responsibilities).toEqual(["Ship services"]);
    expect(draft?.yearsExperience).toBe(5);
  });

  it("caps how many bullets and how long each one can be", () => {
    const raw = {
      skills: ["Go"],
      requirements: Array.from({ length: 30 }, (_, i) => `req ${i}`),
      responsibilities: ["y".repeat(500)],
    };
    const draft = buildListingDraft(job({ brief: raw }));
    expect(draft?.requirements).toHaveLength(12);
    expect(draft?.responsibilities[0]?.length).toBeLessThanOrEqual(301);
    expect(draft?.responsibilities[0]?.endsWith("…")).toBe(true);
  });

  it.each([[0], [-3], [80]])("drops an out-of-range yearsExperience of %p", (years) => {
    const raw = { skills: ["Go"], yearsExperience: years };
    expect(buildListingDraft(job({ brief: raw }))?.yearsExperience).toBeNull();
  });

  it("gives two reposts of one posting the same match key but different source urls", () => {
    const a = buildListingDraft(
      job({ url: "https://linkedin.com/jobs/1", boardId: "linkedin-board" }),
    );
    const b = buildListingDraft(
      job({ url: "https://indeed.com/viewjob?jk=9", boardId: "indeed-board" }),
    );
    expect(a?.matchKey).toBe(b?.matchKey as string);
    expect(a?.slug).toBe(b?.slug as string);
    expect(a?.url).not.toBe(b?.url as string);
  });
});

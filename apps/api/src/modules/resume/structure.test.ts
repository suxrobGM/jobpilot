import { EMPTY_RESUME_DATA, type ResumeData } from "@jobpilot/contracts/resume";
import { applyStructure, UMBRELLA_COMPANY_NAMES } from "./structure";
import { describe, expect, it } from "bun:test";

function base(over: Partial<ResumeData> = {}): ResumeData {
  return {
    // Spread first so a new resume section never breaks every fixture that predates it.
    ...EMPTY_RESUME_DATA,
    basics: { name: "Sam Doe" },
    summary: "Engineer.",
    experience: [
      {
        company: "Recent Co",
        title: "Senior Engineer",
        start: "Jan 2025",
        end: "Jun 2025",
        bullets: ["Shipped A."],
      },
      {
        company: "Mid Co",
        title: "Engineer",
        start: "Jul 2022",
        end: "Dec 2023",
        bullets: ["Shipped B."],
      },
      {
        company: "Old Co",
        title: "Developer",
        start: "Sep 2020",
        end: "Oct 2021",
        bullets: ["Shipped C."],
      },
      {
        company: "Older Co",
        title: "Game Developer",
        start: "Mar 2020",
        end: "Feb 2021",
        bullets: ["Shipped D."],
      },
    ],
    projects: [
      { name: "Alpha", bullets: ["Built Alpha."], keywords: [], start: "2024", end: "Present" },
      { name: "Beta", bullets: ["Built Beta."], keywords: [] },
    ],
    skills: [],
    education: [],
    ...over,
  };
}

describe("applyStructure - merge", () => {
  it("collapses overlapping roles into one umbrella entry with a server-derived range", () => {
    const result = applyStructure(base(), {
      mergeEntries: [{ into: 2, from: [3], company: "Independent / Contract" }],
    });

    expect(result.ok).toBe(true);
    const merged = result.content.experience.find((e) => e.company === "Independent / Contract");
    // Earliest start, latest end - the overlap disappears without inventing dates.
    expect(merged).toMatchObject({ start: "Mar 2020", end: "Oct 2021" });
    expect(merged?.bullets).toEqual(["Shipped C.", "Shipped D."]);
    expect(result.content.experience).toHaveLength(3);
    expect(result.audit.merged[0]).toMatchObject({ absorbed: ["Older Co"] });
  });

  it("cannot widen a date range beyond the merged roles", () => {
    const result = applyStructure(base(), {
      mergeEntries: [{ into: 2, from: [3] }],
    });
    const merged = result.content.experience[2];
    // The model has no field to pass dates through; these come from the entries themselves.
    expect(merged.start).toBe("Mar 2020");
    expect(merged.end).not.toBe("Present");
  });

  it("keeps an open-ended role open", () => {
    const data = base();
    data.experience[0].end = "Present";
    const result = applyStructure(data, { mergeEntries: [{ into: 0, from: [1] }] });
    expect(result.content.experience[0].end).toBe("Present");
  });

  it("rejects an employer that is neither merged nor an umbrella name", () => {
    const result = applyStructure(base(), {
      mergeEntries: [{ into: 2, from: [3], company: "Google" }],
    });
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toContain("Google");
  });

  it("accepts every umbrella name and any merged employer", () => {
    for (const company of [...UMBRELLA_COMPANY_NAMES, "Old Co", "Older Co"]) {
      const result = applyStructure(base(), { mergeEntries: [{ into: 2, from: [3], company }] });
      expect(result.ok).toBe(true);
    }
  });

  it("flags a retitle that shares no word with the original", () => {
    const result = applyStructure(base(), {
      mergeEntries: [{ into: 2, from: [3], title: "Principal Data Scientist" }],
    });
    expect(result.ok).toBe(true);
    expect(result.audit.flags).toEqual([`retitled: "Developer" -> "Principal Data Scientist"`]);
  });

  it("does not flag a retitle that still describes the role", () => {
    const result = applyStructure(base(), {
      mergeEntries: [{ into: 2, from: [3], title: "Senior Developer" }],
    });
    expect(result.audit.flags).toEqual([]);
    expect(result.audit.retitled).toHaveLength(1);
  });

  it("rejects merging an entry into itself and unknown indices", () => {
    expect(applyStructure(base(), { mergeEntries: [{ into: 1, from: [1] }] }).ok).toBe(false);
    expect(applyStructure(base(), { mergeEntries: [{ into: 0, from: [9] }] }).ok).toBe(false);
  });
});

describe("applyStructure - drop", () => {
  it("drops an entry and records it", () => {
    const result = applyStructure(base(), { dropEntries: [3] });
    expect(result.ok).toBe(true);
    expect(result.content.experience).toHaveLength(3);
    expect(result.audit.dropped).toEqual(["Older Co"]);
  });

  it("refuses to drop more than half the history", () => {
    const result = applyStructure(base(), { dropEntries: [1, 2, 3] });
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toContain("at most half");
  });

  it("refuses to empty the experience section", () => {
    const single = base({
      experience: [{ company: "Only Co", title: "Engineer", start: "2024", bullets: [] }],
    });
    const result = applyStructure(single, { dropEntries: [0] });
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toContain("at least one experience entry");
  });
});

describe("applyStructure - promote projects", () => {
  it("builds a dated umbrella entry from the projects' own dates", () => {
    const result = applyStructure(base(), { promoteProjects: { projects: [0] } });

    expect(result.ok).toBe(true);
    const promoted = result.content.experience.find((e) => e.company.startsWith("Independent"));
    expect(promoted).toMatchObject({ start: "2024", end: "Present" });
    // Bullets carry the project name so a promoted line still says what it belongs to.
    expect(promoted?.bullets).toEqual(["Alpha: Built Alpha."]);
    expect(result.audit.promoted[0]).toMatchObject({ projects: ["Alpha"] });
  });

  it("places the promoted entry newest-first rather than appending", () => {
    const result = applyStructure(base(), { promoteProjects: { projects: [0] } });
    // Alpha starts 2024, before Jan 2025, so it sits second - not last.
    expect(result.content.experience.map((e) => e.company)).toEqual([
      "Recent Co",
      "Independent Software Development",
      "Mid Co",
      "Old Co",
      "Older Co",
    ]);
  });

  it("refuses to promote a project with no dates instead of inventing a range", () => {
    const result = applyStructure(base(), { promoteProjects: { projects: [1] } });
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toContain("Beta");
    expect(result.violations[0]).toContain("never invented");
  });

  it("rejects a real employer name on a promoted entry", () => {
    const result = applyStructure(base(), {
      promoteProjects: { projects: [0], company: "Stripe" },
    });
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toContain("Stripe");
  });
});

describe("applyStructure - reorder", () => {
  it("reorders surviving entries", () => {
    const result = applyStructure(base(), { entryOrder: [1, 0, 2, 3] });
    expect(result.ok).toBe(true);
    expect(result.content.experience.map((e) => e.company)).toEqual([
      "Mid Co",
      "Recent Co",
      "Old Co",
      "Older Co",
    ]);
    expect(result.audit.reordered).toBe(true);
  });

  it("rejects an order that is not a permutation of the survivors", () => {
    const result = applyStructure(base(), { entryOrder: [0, 1] });
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toContain("permutation");
  });

  it("indices refer to the base, so a drop plus a reorder compose", () => {
    const result = applyStructure(base(), { dropEntries: [3], entryOrder: [2, 1, 0] });
    expect(result.ok).toBe(true);
    expect(result.content.experience.map((e) => e.company)).toEqual([
      "Old Co",
      "Mid Co",
      "Recent Co",
    ]);
  });

  it("moves listed projects to the front and keeps the rest in order", () => {
    const result = applyStructure(base(), { projectOrder: [1] });
    expect(result.content.projects.map((p) => p.name)).toEqual(["Beta", "Alpha"]);
  });
});

describe("applyStructure - no plan", () => {
  it("returns the base untouched", () => {
    const data = base();
    const result = applyStructure(data, {});
    expect(result.ok).toBe(true);
    expect(result.content.experience).toEqual(data.experience);
    expect(result.audit).toMatchObject({ merged: [], dropped: [], promoted: [], reordered: false });
  });
});

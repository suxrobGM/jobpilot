import { EMPTY_RESUME_DATA, type ResumeData } from "@jobpilot/contracts/resume";
import { HttpError } from "@/common/errors";
import { buildTailoredVariant, type TailorVariantBody } from "./tailor-variant";
import { describe, expect, it } from "bun:test";

function base(): ResumeData {
  return {
    // Spread first so a new resume section never breaks every fixture that predates it.
    ...EMPTY_RESUME_DATA,
    basics: { name: "Sam Doe", headline: "Frontend Engineer" },
    summary: "Engineer.",
    experience: [
      {
        company: "Recent Co",
        title: "Senior Engineer",
        start: "Jan 2025",
        bullets: ["Shipped A."],
      },
      {
        company: "Mid Co",
        title: "Engineer",
        start: "Jul 2022",
        end: "Dec 2023",
        bullets: ["Cut latency by 40%."],
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
        title: "Developer",
        start: "Mar 2020",
        end: "Feb 2021",
        bullets: ["Shipped D."],
      },
    ],
    projects: [],
    skills: [],
    education: [],
  };
}

function body(over: Partial<TailorVariantBody> = {}): TailorVariantBody {
  return { label: "Acme - Engineer", ...over };
}

function violationsOf(fn: () => unknown): string[] {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(422);
    return (error as HttpError).details as string[];
  }
  throw new Error("expected a 422");
}

describe("buildTailoredVariant", () => {
  it("carries the research sections through untouched", () => {
    const academic = {
      ...base(),
      publications: [{ title: "Segmentation under domain shift", venue: "CVPR", year: "2024" }],
      awards: [{ title: "Best Paper", issuer: "CVPR", year: "2024" }],
      certifications: [{ name: "AWS Solutions Architect", issuer: "Amazon" }],
      sections: [
        {
          title: "Grants",
          entries: [{ heading: "NSF CAREER", subheading: "NSF", meta: "2023", bullets: [] }],
        },
      ],
    };

    // Tailoring reorders and rewords; it must never be the reason a CV loses a section.
    const result = buildTailoredVariant(academic, body({ emphasizedTech: ["pytorch"] }));

    expect(result.content.publications).toEqual(academic.publications);
    expect(result.content.awards).toEqual(academic.awards);
    expect(result.content.certifications).toEqual(academic.certifications);
    expect(result.content.sections).toEqual(academic.sections);
  });

  it("rewords an entry at the bottom of the timeline", () => {
    const result = buildTailoredVariant(
      base(),
      body({
        bulletRewrites: [
          { entryIndex: 3, bullets: [{ original: "Shipped D.", tailored: "Delivered D." }] },
        ],
      }),
    );

    expect(result.content.experience[3].bullets).toEqual(["Delivered D."]);
    expect(result.rewordedBullets).toBe(1);
    expect(result.audit?.experience).toHaveLength(1);
  });

  it("refuses a rewrite that invents a number", () => {
    const violations = violationsOf(() =>
      buildTailoredVariant(
        base(),
        body({
          bulletRewrites: [
            {
              entryIndex: 0,
              bullets: [{ original: "Shipped A.", tailored: "Shipped A to 12k users." }],
            },
          ],
        }),
      ),
    );

    expect(violations[0]).toContain("12k");
  });

  it("keeps a number the original already stated", () => {
    const result = buildTailoredVariant(
      base(),
      body({
        bulletRewrites: [
          {
            entryIndex: 1,
            bullets: [{ original: "Cut latency by 40%.", tailored: "Cut request latency 40%." }],
          },
        ],
      }),
    );

    expect(result.content.experience[1].bullets).toEqual(["Cut request latency 40%."]);
  });

  it("validates rewrites against the restructured entries, not the base ones", () => {
    const result = buildTailoredVariant(
      base(),
      body({
        structure: {
          mergeEntries: [{ into: 2, from: [3], company: "Independent / Contract" }],
        },
        // Only reachable post-merge: "Shipped D." belonged to base entry 3.
        bulletRewrites: [
          { entryIndex: 2, bullets: [{ original: "Shipped D.", tailored: "Delivered D." }] },
        ],
      }),
    );

    expect(result.content.experience).toHaveLength(3);
    expect(result.content.experience[2].bullets).toEqual(["Shipped C.", "Delivered D."]);
    expect(result.audit?.structure?.merged).toHaveLength(1);
    expect(result.audit?.experience[0]).toMatchObject({
      entryIndex: 2,
      company: "Independent / Contract",
    });
  });

  it("rejects the whole request when the structure plan is invalid", () => {
    const violations = violationsOf(() =>
      buildTailoredVariant(base(), body({ structure: { dropEntries: [0, 1, 2, 3] } })),
    );

    expect(violations.length).toBeGreaterThan(0);
  });

  it("retargets the headline and flags tech the resume never mentions", () => {
    const result = buildTailoredVariant(
      base(),
      body({
        headline: "Backend Engineer",
        bulletRewrites: [
          {
            entryIndex: 0,
            bullets: [{ original: "Shipped A.", tailored: "Shipped A in GraphQL." }],
          },
        ],
      }),
    );

    expect(result.content.basics.headline).toBe("Backend Engineer");
    expect(result.flags.some((flag) => flag.includes("GraphQL"))).toBe(true);
  });

  it("stores no audit when nothing was reworded or restructured", () => {
    const result = buildTailoredVariant(base(), body({ summary: "Targeted summary." }));

    expect(result.audit).toBeNull();
    expect(result.rewordedBullets).toBe(0);
    expect(result.content.summary).toBe("Targeted summary.");
  });
});

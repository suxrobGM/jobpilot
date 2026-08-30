// Deterministic reordering. `tailor.ts` imports only `keyword-normalize` + types, so no env/Prisma.

import { EMPTY_RESUME_DATA, type ResumeData } from "@jobpilot/contracts/resume";
import { tailorBase } from "./tailor";
import { describe, expect, it } from "bun:test";

const base = (over: Partial<ResumeData>): ResumeData => ({
  // Spread first so a new resume section never breaks every fixture that predates it.
  ...EMPTY_RESUME_DATA,
  basics: { name: "Test Candidate" },
  ...over,
});

const withBullets = (bullets: string[]): ResumeData =>
  base({
    experience: [{ company: "Acme", title: "Engineer", start: "2020", bullets }],
  });

describe("tailorBase - bullet ranking", () => {
  it("ranks bullets by how many job keywords they carry", () => {
    const result = tailorBase(
      withBullets(["Wrote documentation", "Built a React app backed by Postgres"]),
      { jobKeywords: ["react", "postgres"] },
    );
    expect(result.experience[0]?.bullets[0]).toBe("Built a React app backed by Postgres");
  });

  it("keeps the original order among bullets that tie", () => {
    const result = tailorBase(withBullets(["First bullet", "Second bullet"]), {
      jobKeywords: ["kubernetes"],
    });
    expect(result.experience[0]?.bullets).toEqual(["First bullet", "Second bullet"]);
  });

  it("matches a keyword only on whole words, so 'go' does not score 'good'", () => {
    const result = tailorBase(withBullets(["Delivered good results", "Wrote Go services"]), {
      jobKeywords: ["go"],
    });
    expect(result.experience[0]?.bullets[0]).toBe("Wrote Go services");
  });

  it("scores a keyword through its synonyms", () => {
    const result = tailorBase(withBullets(["Managed releases", "Ran Kubernetes clusters"]), {
      jobKeywords: ["k8s"],
    });
    expect(result.experience[0]?.bullets[0]).toBe("Ran Kubernetes clusters");
  });

  it("keeps C# and C++ apart", () => {
    const result = tailorBase(withBullets(["Wrote C++ tooling", "Wrote C# services"]), {
      jobKeywords: ["c#"],
    });
    expect(result.experience[0]?.bullets[0]).toBe("Wrote C# services");
  });

  it("caps each entry at maxBulletsPerEntry", () => {
    const result = tailorBase(withBullets(["a", "b", "c", "d"]), {
      jobKeywords: ["react"],
      maxBulletsPerEntry: 2,
    });
    expect(result.experience[0]?.bullets).toHaveLength(2);
  });

  it("leaves bullets untouched when no keywords are given", () => {
    const result = tailorBase(withBullets(["b", "a"]), {});
    expect(result.experience[0]?.bullets).toEqual(["b", "a"]);
  });
});

describe("tailorBase - skill emphasis", () => {
  const skilled = base({
    skills: [
      { group: "Tools", items: ["Docker", "Jira"] },
      { group: "Languages", items: ["Java", "TypeScript"] },
    ],
  });

  it("floats the group holding an emphasized term and surfaces that item first", () => {
    const result = tailorBase(skilled, { emphasizedTech: ["typescript"] });
    expect(result.skills[0]?.group).toBe("Languages");
    expect(result.skills[0]?.items).toEqual(["TypeScript", "Java"]);
  });

  it("does not emphasize on a partial word ('java' must not pull in 'JavaScript')", () => {
    const scripted = base({ skills: [{ group: "Languages", items: ["JavaScript", "Java"] }] });
    const result = tailorBase(scripted, { emphasizedTech: ["java"] });
    expect(result.skills[0]?.items).toEqual(["Java", "JavaScript"]);
  });

  it("leaves group order alone when nothing is emphasized", () => {
    const result = tailorBase(skilled, {});
    expect(result.skills.map((g) => g.group)).toEqual(["Tools", "Languages"]);
  });
});

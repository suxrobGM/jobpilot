import { APPLIED_DUPLICATE_THRESHOLD, findFuzzyDuplicate } from "./applied-duplicates";
import { describe, expect, it } from "bun:test";

function candidate(title: string, company: string) {
  return [
    {
      id: "prior",
      url: "https://hiringcafe.com/job/prior",
      title,
      company,
      appliedAt: new Date("2026-08-05T12:00:00Z"),
    },
  ];
}

function match(title: string, company: string, priorTitle: string, priorCompany: string) {
  return findFuzzyDuplicate(
    { title, company },
    candidate(priorTitle, priorCompany),
    APPLIED_DUPLICATE_THRESHOLD,
  );
}

describe("findFuzzyDuplicate - repeat applications it must catch", () => {
  it("catches the identical posting relisted under a second host", () => {
    expect(
      match(
        "Director of Engineering, Trading",
        "Alpaca",
        "Director of Engineering, Trading",
        "Alpaca",
      ),
    ).toMatchObject({ score: 100 });
  });

  it("catches the same role spelled out instead of abbreviated", () => {
    expect(
      match(
        "(Remote) Vice President of Research & Development",
        "Harris Computer",
        "(Remote) VP of R&D",
        "Harris Computer",
      ),
    ).not.toBeNull();
  });

  it("catches an employer whose scraped name has page text glued on", () => {
    // The row really was stored as "AbbVieNew York Stock Exchange"; similarity alone gives 84.
    expect(
      match(
        "Executive Director, Engineering - Allergan Aesthetics",
        "AbbVie",
        "Executive Director, Engineering - Allergan Aesthetics",
        "AbbVieNew York Stock Exchange",
      ),
    ).not.toBeNull();
  });

  // Short names too, where there is not enough name left to carry a similarity score.
  it.each([
    ["Meta", "MetaNASDAQ"],
    ["IBM", "IBMNew York Stock Exchange"],
    ["Nike", "Nike Inc.NYSE"],
    ["Etsy", "EtsyNASDAQ"],
  ])("catches %s against its glued form %s", (company, scraped) => {
    expect(match("Software Engineer", company, "Software Engineer", scraped)).not.toBeNull();
  });

  it.each([
    ["Dell", "Dell Technologies"],
    ["Uber", "Uber Technologies"],
    ["Zoom", "Zoom Video Communications"],
  ])("catches %s against its legal name %s", (company, legal) => {
    expect(match("Backend Engineer", company, "Backend Engineer", legal)).not.toBeNull();
  });

  it("still catches a seniority-only title difference at one employer", () => {
    expect(
      match("Senior Frontend Engineer", "Acme Inc", "Frontend Engineer", "Acme"),
    ).not.toBeNull();
  });
});

describe("findFuzzyDuplicate - distinct employers it must not block", () => {
  it("does not match Clarity against Cardiff on a shared generic title", () => {
    expect(
      match("Director of Engineering", "Cardiff", "Director of Engineering", "Clarity"),
    ).toBeNull();
  });

  it("does not match Robots & Pencils against Robust Open Online Safety Tools", () => {
    expect(
      match(
        "Director of Engineering",
        "Robots & Pencils",
        "Director of Engineering",
        "Robust Open Online Safety Tools",
      ),
    ).toBeNull();
  });

  it("does not match Orbital Engineering against Imagine Learning", () => {
    expect(
      match(
        "Director of Software Engineering",
        "Orbital Engineering",
        "Director of Software Engineering",
        "Imagine Learning",
      ),
    ).toBeNull();
  });

  it("does not match a different role at the same employer", () => {
    expect(match("Warehouse Associate", "Acme", "Frontend Engineer", "Acme")).toBeNull();
  });

  // The prefix arm reads whole tokens, so a name continuing the shorter one's word is out.
  it("does not match Delphi against Delphix Systems", () => {
    expect(match("Backend Engineer", "Delphi", "Backend Engineer", "Delphix Systems")).toBeNull();
  });

  it("does not strip an exchange suffix that is the whole employer name", () => {
    expect(match("Analyst", "NASDAQ", "Analyst", "Euronext")).toBeNull();
  });
});

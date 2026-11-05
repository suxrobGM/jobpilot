import { listingSlug, matchKey, normalizeListingLocation } from "./listing-identity";
import { describe, expect, it } from "bun:test";

const acme = { title: "Senior Software Engineer", company: "Acme Inc.", location: "New York, NY" };

describe("normalizeListingLocation", () => {
  it("maps remote-ish text onto one bucket", () => {
    for (const value of ["Remote", "Remote - US", "Anywhere", "Work From Home", "remote (WFH)"]) {
      expect(normalizeListingLocation(value)).toBe("remote");
    }
  });

  it("keeps only the city segment so suffixes don't split a posting", () => {
    expect(normalizeListingLocation("New York, NY, USA")).toBe("new york");
    expect(normalizeListingLocation("New York, NY")).toBe("new york");
  });

  it("treats a missing location as empty", () => {
    expect(normalizeListingLocation(null)).toBe("");
  });
});

describe("matchKey", () => {
  it("matches the same posting reposted on another board", () => {
    expect(matchKey(acme)).toBe(
      matchKey({
        title: "senior  software   engineer",
        company: "ACME, Inc",
        location: "New York, NY, USA",
      }),
    );
  });

  // The reason this module does not reuse scoring's `normalizeJobTitle`, which strips seniority.
  it("does NOT merge different seniorities at the same company", () => {
    expect(matchKey({ ...acme, title: "Senior Software Engineer" })).not.toBe(
      matchKey({ ...acme, title: "Junior Software Engineer" }),
    );
  });

  it("does not merge the same role opened in two cities", () => {
    expect(matchKey({ ...acme, location: "New York, NY" })).not.toBe(
      matchKey({ ...acme, location: "San Francisco, CA" }),
    );
  });

  it("separates a remote opening from an on-site one", () => {
    expect(matchKey({ ...acme, location: "Remote" })).not.toBe(matchKey(acme));
  });

  it("distinguishes companies", () => {
    expect(matchKey(acme)).not.toBe(matchKey({ ...acme, company: "Globex" }));
  });
});

describe("listingSlug", () => {
  it("is kebab-cased, human-readable and key-suffixed", () => {
    expect(listingSlug(acme)).toBe(
      `senior-software-engineer-at-acme-inc-${matchKey(acme).slice(0, 6)}`,
    );
  });

  it("is stable across re-scrapes of the same posting", () => {
    expect(listingSlug(acme)).toBe(
      listingSlug({
        title: "Senior Software Engineer",
        company: "Acme Inc.",
        location: "New York, NY, USA",
      }),
    );
  });

  it("survives a title that is entirely punctuation", () => {
    const slug = listingSlug({ title: "!!!", company: "Acme" });
    expect(slug.startsWith("at-acme-")).toBe(true);
  });
});

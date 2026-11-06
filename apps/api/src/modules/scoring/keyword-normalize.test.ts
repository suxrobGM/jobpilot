// Pure string helpers - no env/Prisma. Imported directly from the module file.

import {
  expandSynonyms,
  hasWholeToken,
  matchesTerm,
  normalizeKeyword,
  normalizeMatchPhrase,
  normalizePhrase,
  toSearchText,
} from "./keyword-normalize";
import { describe, expect, it } from "bun:test";

describe("normalizeKeyword", () => {
  it("lowercases and strips all non-alphanumerics", () => {
    expect(normalizeKeyword("Next.js")).toBe("nextjs");
    expect(normalizeKeyword("C++")).toBe("c++");
    expect(normalizeKeyword("C#")).toBe("c#");
    expect(normalizeKeyword("React JS")).toBe("reactjs");
  });
});

describe("normalizeMatchPhrase", () => {
  it("collapses to single spaces while keeping + and #", () => {
    expect(normalizeMatchPhrase("C++ / C# devs")).toBe("c++ c# devs");
    expect(normalizeMatchPhrase("Node.js")).toBe("node js");
    expect(normalizeMatchPhrase("  Node/Express  ")).toBe("node express");
  });
});

describe("normalizePhrase", () => {
  it("collapses non-alphanumerics to single spaces, preserving word boundaries", () => {
    expect(normalizePhrase("React.js applications")).toBe("react js applications");
    expect(normalizePhrase("  Node/Express  ")).toBe("node express");
  });
});

describe("expandSynonyms", () => {
  it("expands a canonical term to all its recognised spellings", () => {
    const variants = expandSynonyms("js");
    expect(variants).toContain("js");
    expect(variants).toContain("javascript");
  });

  it("expands an alternate spelling back through its canonical term", () => {
    // "javascript" is an alt of the canon "js"; both directions must resolve to the shared set.
    const variants = expandSynonyms("JavaScript");
    expect(variants).toContain("js");
    expect(variants).toContain("javascript");
  });

  it("normalizes a plain term to its compact form with no synonyms", () => {
    expect(expandSynonyms("Rust")).toEqual(["rust"]);
  });

  it("keeps the C++ and C# families apart", () => {
    const cpp = expandSynonyms("C++");
    const csharp = expandSynonyms("C#");
    expect(csharp).toContain("csharp");
    expect(cpp.filter((variant) => csharp.includes(variant))).toEqual([]);
  });

  it("expands abbreviations outside tech in both directions", () => {
    expect(expandSynonyms("RN")).toContain("registered nurse");
    expect(expandSynonyms("registered nurse")).toContain("rn");
    expect(expandSynonyms("CPA")).toContain("certified public accountant");
  });
});

describe("hasWholeToken", () => {
  const text = toSearchText("Wrote Go services and good docs");

  it("matches a token on word boundaries, not inside a longer word", () => {
    expect(hasWholeToken(text, "go")).toBe(true);
    expect(hasWholeToken(text, "oo")).toBe(false);
    expect(hasWholeToken(text, "doc")).toBe(false);
  });

  it("matches the first and last token", () => {
    expect(hasWholeToken(text, "wrote")).toBe(true);
    expect(hasWholeToken(text, "docs")).toBe(true);
  });

  it("matches a multi-word token", () => {
    expect(hasWholeToken(toSearchText("SQL Server admin"), "sql server")).toBe(true);
  });

  it("never matches an empty token", () => {
    expect(hasWholeToken(text, "")).toBe(false);
  });
});

describe("matchesTerm", () => {
  it("matches through synonyms", () => {
    expect(matchesTerm(toSearchText("Ran Kubernetes clusters"), "k8s")).toBe(true);
  });

  it("keeps C# out of C++ text", () => {
    const text = toSearchText("Wrote C++ tooling");
    expect(matchesTerm(text, "c#")).toBe(false);
    expect(matchesTerm(text, "c++")).toBe(true);
  });

  it("does not match a term inside a longer word", () => {
    expect(matchesTerm(toSearchText("Built a JavaScript app"), "java")).toBe(false);
  });
});

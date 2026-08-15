import { canonicalizeJobUrl } from "./job-url";
import { describe, expect, it } from "bun:test";

describe("canonicalizeJobUrl", () => {
  it("forces https", () => {
    expect(canonicalizeJobUrl("http://example.test/jobs/1")).toBe("https://example.test/jobs/1");
  });

  it("drops www, so a board is one host whichever link the agent followed", () => {
    expect(canonicalizeJobUrl("https://www.indeed.com/viewjob?jk=123")).toBe(
      "https://indeed.com/viewjob?jk=123",
    );
  });

  it("lower-cases the host but never the path", () => {
    expect(canonicalizeJobUrl("https://Example.TEST/Jobs/AbC")).toBe(
      "https://example.test/Jobs/AbC",
    );
  });

  it("drops tracking params and the fragment, keeps the ones that identify the posting", () => {
    expect(
      canonicalizeJobUrl("https://example.test/viewjob?utm_source=x&jk=123&gh_src=y#apply"),
    ).toBe("https://example.test/viewjob?jk=123");
  });

  it("sorts the surviving params, so two orderings are one row", () => {
    expect(canonicalizeJobUrl("https://example.test/j?b=2&a=1")).toBe(
      "https://example.test/j?a=1&b=2",
    );
  });

  it("drops a trailing slash but keeps a bare root", () => {
    expect(canonicalizeJobUrl("https://example.test/jobs/1/")).toBe("https://example.test/jobs/1");
    expect(canonicalizeJobUrl("https://example.test/")).toBe("https://example.test/");
  });

  // The real pair: same job id slug, two hosts, two applications sent.
  it("folds hiring.cafe onto hiringcafe.com, path untouched", () => {
    expect(
      canonicalizeJobUrl(
        "https://hiring.cafe/job/director-of-engineering-trading-alpaca-38fjvmoguw6zvq7r",
      ),
    ).toBe("https://hiringcafe.com/job/director-of-engineering-trading-alpaca-38fjvmoguw6zvq7r");
  });

  it("folds the www variant of the alias target too", () => {
    expect(canonicalizeJobUrl("https://www.hiringcafe.com/job/abc")).toBe(
      "https://hiringcafe.com/job/abc",
    );
  });

  it("leaves an already-canonical url byte-identical", () => {
    const url = "https://hiringcafe.com/job/abc";
    expect(canonicalizeJobUrl(url)).toBe(url);
  });

  it("returns an unparseable value untouched rather than throwing", () => {
    expect(canonicalizeJobUrl("not a url")).toBe("not a url");
  });

  it("leaves a non-http url alone", () => {
    expect(canonicalizeJobUrl("mailto:jobs@example.test")).toBe("mailto:jobs@example.test");
  });
});

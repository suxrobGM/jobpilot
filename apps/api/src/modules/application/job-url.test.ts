import { canonicalizeJobUrl } from "./job-url";
import { describe, expect, it } from "bun:test";

describe("canonicalizeJobUrl", () => {
  // The real pair: same job id slug, two hosts, two applications sent.
  it("folds hiring.cafe onto hiringcafe.com, path untouched", () => {
    expect(
      canonicalizeJobUrl(
        "https://hiring.cafe/job/director-of-engineering-trading-alpaca-united-states-38fjvmoguw6zvq7r",
      ),
    ).toBe(
      "https://hiringcafe.com/job/director-of-engineering-trading-alpaca-united-states-38fjvmoguw6zvq7r",
    );
  });

  it("folds the www variant", () => {
    expect(canonicalizeJobUrl("https://www.hiringcafe.com/job/abc")).toBe(
      "https://hiringcafe.com/job/abc",
    );
  });

  it("leaves an already-canonical url byte-identical", () => {
    const url = "https://hiringcafe.com/job/abc";
    expect(canonicalizeJobUrl(url)).toBe(url);
  });

  it("leaves other boards alone", () => {
    const url = "https://www.indeed.com/viewjob?jk=123";
    expect(canonicalizeJobUrl(url)).toBe(url);
  });

  it("returns an unparseable value untouched rather than throwing", () => {
    expect(canonicalizeJobUrl("not a url")).toBe("not a url");
  });
});

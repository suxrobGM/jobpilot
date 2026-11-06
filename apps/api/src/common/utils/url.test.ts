import { normalizeJobUrl } from "./url";
import { describe, expect, it } from "bun:test";

describe("normalizeJobUrl", () => {
  it("forces https", () => {
    expect(normalizeJobUrl("http://example.test/jobs/1")).toBe("https://example.test/jobs/1");
  });

  it("drops www, so a board is one host whichever link the agent followed", () => {
    expect(normalizeJobUrl("https://www.indeed.com/viewjob?jk=123")).toBe(
      "https://indeed.com/viewjob?jk=123",
    );
  });

  it("lower-cases the host but never the path", () => {
    expect(normalizeJobUrl("https://Example.TEST/Jobs/AbC")).toBe("https://example.test/Jobs/AbC");
  });

  it("drops tracking params and the fragment, keeps the ones that identify the posting", () => {
    expect(normalizeJobUrl("https://example.test/viewjob?utm_source=x&jk=123&gh_src=y#apply")).toBe(
      "https://example.test/viewjob?jk=123",
    );
  });

  it("sorts the surviving params, so two orderings are one row", () => {
    expect(normalizeJobUrl("https://example.test/j?b=2&a=1")).toBe(
      "https://example.test/j?a=1&b=2",
    );
  });

  it("drops a trailing slash but keeps a bare root", () => {
    expect(normalizeJobUrl("https://example.test/jobs/1/")).toBe("https://example.test/jobs/1");
    expect(normalizeJobUrl("https://example.test/")).toBe("https://example.test/");
  });

  // The real pair: same job id slug, two hosts, two applications sent.
  it("folds hiring.cafe onto hiringcafe.com, path untouched", () => {
    expect(
      normalizeJobUrl(
        "https://hiring.cafe/job/director-of-engineering-trading-alpaca-38fjvmoguw6zvq7r",
      ),
    ).toBe("https://hiringcafe.com/job/director-of-engineering-trading-alpaca-38fjvmoguw6zvq7r");
  });

  it("folds the www variant of the alias target too", () => {
    expect(normalizeJobUrl("https://www.hiringcafe.com/job/abc")).toBe(
      "https://hiringcafe.com/job/abc",
    );
  });

  it("leaves an already-canonical url byte-identical", () => {
    const url = "https://hiringcafe.com/job/abc";
    expect(normalizeJobUrl(url)).toBe(url);
  });

  it("returns an unparseable value untouched rather than throwing", () => {
    expect(normalizeJobUrl("not a url")).toBe("not a url");
  });

  it("leaves a non-http url alone", () => {
    expect(normalizeJobUrl("mailto:jobs@example.test")).toBe("mailto:jobs@example.test");
  });
});

describe("normalizeJobUrl: listing-index cases", () => {
  it("strips referrer params the listing index used to strip", () => {
    expect(
      normalizeJobUrl("https://WWW.Example.com/jobs/123/?utm_source=linkedin&ref=abc&src=x#apply"),
    ).toBe("https://example.com/jobs/123");
  });

  it("keeps Greenhouse's gh_jid posting id while dropping gh_src", () => {
    expect(normalizeJobUrl("https://acme.example/careers?gh_jid=4567&gh_src=x")).toBe(
      "https://acme.example/careers?gh_jid=4567",
    );
    expect(normalizeJobUrl("https://acme.example/careers?gh_jid=1")).not.toBe(
      normalizeJobUrl("https://acme.example/careers?gh_jid=2"),
    );
  });

  it("collapses two links to the same posting onto one string", () => {
    const a = normalizeJobUrl("https://boards.example.com/acme/jobs/42?utm_feed=spring");
    const b = normalizeJobUrl("http://boards.example.com/acme/jobs/42/#content");
    expect(a).toBe(b);
  });
});

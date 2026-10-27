import { extractLinks } from "./email.utils";
import { describe, expect, it } from "bun:test";

const encode = (text: string) => Buffer.from(text, "utf-8").toString("base64url");

describe("extractLinks", () => {
  it("keeps each anchor's text so a posting can be told from an unsubscribe link", () => {
    const payload = {
      mimeType: "text/html",
      body: {
        data: encode(
          '<link href="https://x.test/font.css" rel="stylesheet">' +
            '<a href="https://click.test/c/1?a=1&amp;b=2"><b>Staff Engineer</b> at Acme</a>' +
            '<a href="https://click.test/uu/2">Unsubscribe</a>' +
            "<a href='mailto:someone@example.com'>mail</a>",
        ),
      },
    };
    expect(extractLinks(payload)).toEqual([
      { url: "https://click.test/c/1?a=1&b=2", text: "Staff Engineer at Acme" },
      { url: "https://click.test/uu/2", text: "Unsubscribe" },
    ]);
  });

  it("falls back to an image's alt text for an image-only anchor", () => {
    const payload = {
      mimeType: "text/html",
      body: { data: encode('<a href="https://click.test/logo"><img src="x.png" alt="Acme"></a>') },
    };
    expect(extractLinks(payload)).toEqual([{ url: "https://click.test/logo", text: "Acme" }]);
  });

  it("merges plain-text URLs and anchors across parts, filling missing text", () => {
    const payload = {
      mimeType: "multipart/alternative",
      parts: [
        {
          mimeType: "text/plain",
          body: {
            data: encode(
              "https://weworkremotely.com/remote-jobs/acme-lead\nLead Engineer: https://theladders.com/job/1",
            ),
          },
        },
        {
          mimeType: "text/html",
          body: {
            data: encode(
              '<a href="https://weworkremotely.com/remote-jobs/acme-lead">Acme Lead</a>',
            ),
          },
        },
      ],
    };
    expect(extractLinks(payload)).toEqual([
      { url: "https://weworkremotely.com/remote-jobs/acme-lead", text: "Acme Lead" },
      { url: "https://theladders.com/job/1", text: "Lead Engineer:" },
    ]);
  });

  it("returns nothing for a payload without bodies", () => {
    expect(extractLinks(undefined)).toEqual([]);
    expect(extractLinks({ mimeType: "multipart/mixed", parts: [] })).toEqual([]);
  });
});

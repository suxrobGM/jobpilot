// The window concurrency opens: an `Application` row appears only when a result is written, so
// between claim and result two workers can both see "not applied" for one posting. An `applying`
// row is the reservation that closes it. Fixtures are the real GitLab/Alpaca duplicate pair.
import { findInFlightDuplicate, type InFlightReader } from "./in-flight";
import { describe, expect, it } from "bun:test";

const GITLAB_LEGACY =
  "https://hiring.cafe/job/director-of-engineering-growth-and-monetization-gitlab-canada-q05zkngwllkfigpu";
const GITLAB_CANONICAL =
  "https://hiringcafe.com/job/director-of-engineering-growth-and-monetization-gitlab-canada-q05zkngwllkfigpu";

/** Honors the NOT clause the real query sends, so self-exclusion is actually exercised. */
function reader(rows: Array<Record<string, unknown>>): InFlightReader {
  return {
    job: {
      findMany: async ({ where }: { where: { NOT?: { campaignId: string; key: string } } }) =>
        rows.filter(
          (row) => !(row.campaignId === where.NOT?.campaignId && row.key === where.NOT?.key),
        ),
    },
  } as unknown as InFlightReader;
}

const CLAIMING = {
  campaignId: "c2",
  key: "j2",
  url: GITLAB_CANONICAL,
  title: "Director of Engineering, Growth & Monetization",
  company: "GitLab",
};

describe("findInFlightDuplicate", () => {
  it("blocks the same posting held under the other host", async () => {
    const db = reader([
      {
        campaignId: "c1",
        key: "j1",
        url: GITLAB_LEGACY,
        title: "Director of Engineering, Growth & Monetization",
        company: "GitLab",
      },
    ]);

    expect(await findInFlightDuplicate(db, "u1", CLAIMING)).toMatchObject({ key: "j1" });
  });

  it("blocks a relisted posting whose title was rephrased", async () => {
    const db = reader([
      {
        campaignId: "c1",
        key: "j1",
        url: "https://hiringcafe.com/job/remote-vp-of-r-and-d-harris-computer-florida-xsblxi7zpf3smgu2",
        title: "(Remote) VP of R&D",
        company: "Harris Computer",
      },
    ]);

    const claiming = {
      campaignId: "c2",
      key: "j2",
      url: "https://hiringcafe.com/job/remote-vice-president-of-research-and-development-harris-computer-y2bgwhpg4bo",
      title: "(Remote) Vice President of Research & Development",
      company: "Harris Computer",
    };

    expect(await findInFlightDuplicate(db, "u1", claiming)).toMatchObject({ key: "j1" });
  });

  it("ignores the row being claimed itself", async () => {
    const db = reader([{ ...CLAIMING }]);

    expect(await findInFlightDuplicate(db, "u1", CLAIMING)).toBeNull();
  });

  it("lets a different employer through while another apply is open", async () => {
    const db = reader([
      {
        campaignId: "c1",
        key: "j1",
        url: "https://hiringcafe.com/job/director-of-engineering-clarity",
        title: "Director of Engineering",
        company: "Clarity",
      },
    ]);

    const claiming = {
      campaignId: "c2",
      key: "j2",
      url: "https://hiringcafe.com/job/director-of-engineering-cardiff",
      title: "Director of Engineering",
      company: "Cardiff",
    };

    expect(await findInFlightDuplicate(db, "u1", claiming)).toBeNull();
  });

  it("is a no-op when nothing else is being applied to", async () => {
    expect(await findInFlightDuplicate(reader([]), "u1", CLAIMING)).toBeNull();
  });
});

import { DAY_MS } from "@/common/date/buckets";
import { AlreadyAppliedError, assertNotDuplicateApply, type JobPosting } from "./apply-guard";
import { describe, expect, it } from "bun:test";

/** Relative to now, so the fixture stays inside the window as the calendar moves. */
const APPLIED_AT = new Date(Date.now() - 5 * DAY_MS);

const EXISTING = {
  id: "app-1",
  url: "https://example.test/jobs/1",
  title: "Frontend Engineer",
  company: "Acme",
  appliedAt: APPLIED_AT,
  status: "applied",
};

/** Honors the NOT clause the real query sends, so self-exclusion is actually exercised. */
function db(applications: (typeof EXISTING)[], applying: JobPosting[] = []) {
  return {
    application: {
      findUnique: async ({ where }: { where: { userId_url: { url: string } } }) =>
        applications.find((r) => r.url === where.userId_url.url) ?? null,
      findMany: async ({ where }: { where: { appliedAt: { gte: Date } } }) =>
        applications.filter((r) => r.appliedAt >= where.appliedAt.gte),
    },
    campaignJob: {
      findMany: async ({ where }: { where: { NOT: { campaignId: string; key: string } } }) =>
        applying.filter(
          (row) => !(row.campaignId === where.NOT.campaignId && row.key === where.NOT.key),
        ),
    },
  } as unknown as Parameters<typeof assertNotDuplicateApply>[0];
}

const job = (over: Partial<JobPosting>): JobPosting => ({
  campaignId: "c1",
  key: "j1",
  url: EXISTING.url,
  title: "Frontend Engineer",
  company: "Acme",
  ...over,
});

const refusal = (reader: ReturnType<typeof db>, posting: JobPosting) =>
  assertNotDuplicateApply(reader, "u1", posting).then(
    () => null,
    (error: Error) => error,
  );

describe("assertNotDuplicateApply - applied", () => {
  it("blocks the same posting by exact url", async () => {
    expect((await refusal(db([EXISTING]), job({})))?.message).toMatch(/Already applied \(url\)/);
  });

  // The case the url constraint cannot catch: one posting reposted under a second link.
  it("blocks the same job listed at a different url", async () => {
    const posting = job({
      url: "https://other-board.test/postings/999",
      title: "Senior Frontend Engineer",
      company: "Acme Inc",
    });

    expect((await refusal(db([EXISTING]), posting))?.message).toMatch(/Already applied \(fuzzy\)/);
  });

  it("blocks a url that differs only by scheme, www and tracking params", async () => {
    const posting = job({ url: "http://www.example.test/jobs/1?utm_source=newsletter" });

    expect((await refusal(db([EXISTING]), posting))?.message).toMatch(/Already applied \(url\)/);
  });

  // A second application cannot be recalled, so the url arm has no window.
  it("keeps blocking the same url however old the application is", async () => {
    const old = { ...EXISTING, appliedAt: new Date(Date.now() - 200 * DAY_MS), title: "x" };

    expect(await refusal(db([old]), job({}))).toBeInstanceOf(AlreadyAppliedError);
  });

  it("names the clashing application", async () => {
    const day = APPLIED_AT.toISOString().slice(0, 10);

    expect((await refusal(db([EXISTING]), job({ title: "x", company: "y" })))?.message).toMatch(
      new RegExp(`"Frontend Engineer" at Acme on ${day}`),
    );
  });

  it("lets a different role at the same employer through", async () => {
    const posting = job({ url: "https://example.test/jobs/3", title: "Warehouse Associate" });

    expect(await refusal(db([EXISTING]), posting)).toBeNull();
  });
});

const GITLAB_LEGACY =
  "https://hiring.cafe/job/director-of-engineering-growth-and-monetization-gitlab-canada-q05zkngwllkfigpu";
const GITLAB_CANONICAL =
  "https://hiringcafe.com/job/director-of-engineering-growth-and-monetization-gitlab-canada-q05zkngwllkfigpu";

const STARTING = job({
  campaignId: "c2",
  key: "j2",
  url: GITLAB_CANONICAL,
  title: "Director of Engineering, Growth & Monetization",
  company: "GitLab",
});

describe("assertNotDuplicateApply - applying sibling", () => {
  it("blocks the same posting held under the other host", async () => {
    const sibling = { ...STARTING, campaignId: "c1", key: "j1", url: GITLAB_LEGACY };

    expect((await refusal(db([], [sibling]), STARTING))?.message).toMatch(/c1\/j1/);
  });

  it("blocks a relisted posting whose title was rephrased", async () => {
    const sibling = job({
      url: "https://hiringcafe.com/job/remote-vp-of-r-and-d-harris-computer-florida-xsblxi7zpf3smgu2",
      title: "(Remote) VP of R&D",
      company: "Harris Computer",
    });
    const starting = job({
      campaignId: "c2",
      key: "j2",
      url: "https://hiringcafe.com/job/remote-vice-president-of-research-and-development-harris-computer-y2bgwhpg4bo",
      title: "(Remote) Vice President of Research & Development",
      company: "Harris Computer",
    });

    expect((await refusal(db([], [sibling]), starting))?.message).toMatch(/Already applying/);
  });

  it("ignores the row being started itself", async () => {
    expect(await refusal(db([], [STARTING]), STARTING)).toBeNull();
  });

  it("lets a different employer through while another apply is open", async () => {
    const sibling = job({
      url: "https://hiringcafe.com/job/director-of-engineering-clarity",
      title: "Director of Engineering",
      company: "Clarity",
    });
    const starting = job({
      campaignId: "c2",
      key: "j2",
      url: "https://hiringcafe.com/job/director-of-engineering-cardiff",
      title: "Director of Engineering",
      company: "Cardiff",
    });

    expect(await refusal(db([], [sibling]), starting)).toBeNull();
  });
});

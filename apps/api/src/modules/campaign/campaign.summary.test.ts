import type { Prisma } from "@/generated/prisma/client";
import { jobSummary, summarizeCampaigns } from "./campaign.summary";
import { describe, expect, it } from "bun:test";

type Row = { campaignId: string; status: string; _count: { _all: number; matchScore?: number } };

function client(
  jobs: Row[],
  messages: Row[],
  contacts: { campaignId: string; discovered: number }[],
) {
  return {
    campaignJob: { groupBy: async () => jobs },
    networkingMessage: { groupBy: async () => messages },
    $queryRaw: async () => contacts,
  } as unknown as Prisma.TransactionClient;
}

describe("summarizeCampaigns", () => {
  it("derives each campaign's summary from its own rows", async () => {
    const [jobs, networking] = await summarizeCampaigns(
      client(
        [
          { campaignId: "c1", status: "approved", _count: { _all: 2, matchScore: 2 } },
          { campaignId: "c1", status: "skipped", _count: { _all: 1, matchScore: 1 } },
        ],
        [
          { campaignId: "c1", status: "draft", _count: { _all: 1 } },
          { campaignId: "c2", status: "draft", _count: { _all: 2 } },
          { campaignId: "c2", status: "sent", _count: { _all: 3 } },
        ],
        [{ campaignId: "c2", discovered: 4 }],
      ),
      [
        { id: "c1", source: "search" },
        { id: "c2", source: "networking" },
      ],
    );

    expect(jobs.summary).toMatchObject({
      kind: "jobs",
      totalFound: 3,
      qualified: 2,
      remaining: 2,
      scored: 3,
      networkingCount: 1,
    });
    expect(networking.summary).toEqual({
      kind: "networking",
      discovered: 4,
      drafted: 2,
      sent: 3,
      replied: 0,
      bounced: 0,
    });
  });
});

describe("jobSummary", () => {
  // The roll-ups ship on the wire for the installed agent skills, but they are a projection of
  // byStatus; this pins that they cannot drift apart for any mix of statuses.
  it("keeps every roll-up consistent with byStatus", () => {
    const summary = jobSummary(
      ["pending", "approved", "applying", "applied", "failed", "skipped", "needs_user"].map(
        (status) => ({ status, count: 2 }),
      ),
    );
    const c = summary.byStatus;

    expect(summary.totalFound).toBe(14);
    expect(summary.qualified).toBe(14 - c.skipped);
    expect(summary.applied).toBe(c.applied);
    expect(summary.failed).toBe(c.failed);
    expect(summary.skipped).toBe(c.skipped);
    expect(summary.remaining).toBe(c.approved + c.applying + c.needs_user);
  });
});

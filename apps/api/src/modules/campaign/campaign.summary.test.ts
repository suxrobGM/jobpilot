import type { Prisma } from "@/generated/prisma/client";
import { accountSummary, jobSummary, summarizeCampaigns } from "./campaign.summary";
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
  // Installed skills read the roll-ups, so they must never drift from byStatus.
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

describe("accountSummary", () => {
  it("totals statuses and links the draft campaign only when there is exactly one", () => {
    const one = accountSummary(
      [
        { status: "in_progress", count: 2 },
        { status: "paused", count: 1 },
        { status: "completed", count: 4 },
      ],
      [
        { campaignId: "c1", status: "draft", count: 2 },
        { campaignId: "c1", status: "approved", count: 1 },
        { campaignId: "c2", status: "replied", count: 3 },
      ],
    );
    expect(one).toEqual({
      total: 7,
      active: 3,
      replies: 3,
      drafts: { messages: 3, campaigns: 1, campaignId: "c1" },
    });

    const two = accountSummary(
      [],
      [
        { campaignId: "c1", status: "draft", count: 1 },
        { campaignId: "c2", status: "draft", count: 1 },
      ],
    );
    expect(two.drafts).toEqual({ messages: 2, campaigns: 2, campaignId: null });
  });
});

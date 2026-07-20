# Dashboard aggregates (page-scoped counters)

Tier 1 - Correctness · Status: **todo**

## What

Five widgets call `campaignQueries.list()` unfiltered and derive their numbers from the returned
page. `paginationQuery.limit` is capped at `.max(100)` server-side
(`apps/api/src/modules/campaign/campaign.schema.ts:17`), so past 100 campaigns every one of them
silently under-reports. This is the same bug class the 2026-07-20 campaign-detail work fixed for
jobs (funnel, reason breakdown and status filters were all page-scoped); the dashboard was left
untouched because it is pre-existing and needs new API surface rather than a filter.

Affected today:

| Widget | Needs | Wrong past 100 because |
| --- | --- | --- |
| `dashboard/stat-tiles.tsx:17` | count of `in_progress` + `paused` | counts the page |
| `dashboard/stat-tiles.tsx:19` | sum of networking `replied` | sums the page |
| `dashboard/attention-strip.tsx:16` | campaigns with `drafted > 0`, and the total | filters the page |
| `dashboard/now-running.tsx:30` | the `in_progress` subset | filters the page |
| `dashboard/campaign-groups.tsx:27` | every campaign, grouped | renders the page as if complete |
| `applications/applications-panel.tsx:31` | `campaignId → query` label map | map misses older campaigns |

Two adjacent facts found while scoping:

- **`queryKeys.campaigns.stats` (`apps/web/src/api/query-keys.ts:62`) is dead** - no endpoint, no
  caller. It was reserved for exactly this and is the natural key to wire up.
- **`applicationQueries.list()` has its own `take: 500`**
  (`apps/api/src/modules/application/application.service.ts:57`), so the "Applied" / "Interviewing"
  tiles and the whole `FunnelBar` count block are independently wrong past 500 applications.

## Approach

Add `GET /api/campaigns/stats` - one DB-side aggregate serving the count-only widgets:

```
{ byStatus: Record<CampaignStatus, number>,
  drafts: { campaigns: number, total: number, onlyCampaignId: string | null } }
```

`byStatus` is a `campaign.groupBy({ by: ["status"] })`; the draft rollup is a
`networkingMessage.groupBy({ by: ["campaignId"] })`. **The draft predicate must mirror
`foldNetworking` (`campaign.summary.ts:79`, `draft|approved`)** or the strip will disagree with the
campaign detail pages it links to.

`now-running` and `campaign-groups` still want rows, not counts - give them
`list({ status })` / real pagination respectively.

For the label map, prefer enriching the Application DTO with a `campaignQuery` field
(`include: { campaign: { select: { query: true } } }`) over a second unbounded list endpoint: it
deletes the `campaigns` query from `applications-panel` entirely and the label can never be missing
for a row that renders. A `/campaigns/options` endpoint is only needed if the dropdown must list
campaigns with zero applications.

## Watch out

All five widgets currently pass **no arguments**, so they share the query key
`["campaigns","list",{}]` and TanStack dedupes them into a single fetch. Handing each one its own
server-side filter fragments that into N distinct queries, each re-paying `loadCampaignSummaries`
(up to three aggregates across 100 rows). Prefer one stats call over per-widget filters; measure
before assuming narrower filters are cheaper.

## Done when

The tiles, attention strip and funnel counts are correct for a user with >100 campaigns and >500
applications, and no dashboard widget derives a total from a page. A test seeds past both caps and
asserts the counts.

## Notes

- 2026-07-20 - Filed out of the `/simplify` pass on `feat/pilot-reliability-ux`. That branch fixed
  the identical page-scoped-derivation bug for campaign *jobs* (server-side paging + filters, a
  `/jobs/reasons` aggregate, `byStatus` on the summary); the dashboard is the remaining instance.
  Deliberately not bundled - it is pre-existing and needs a new route + contract, not a cleanup.

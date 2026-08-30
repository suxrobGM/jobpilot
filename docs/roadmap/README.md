# JobPilot Roadmap - Index

Consolidated 2026-07-15 around **[The Pilot](pilot.md)** - the T2 plumbing and T5 reflex items
(plus four absorbed T3/T4 items) were folded into it; supersessions are recorded in
[deferred.md](deferred.md) so they aren't re-litigated. Originally from the 2026-07-11
architecture review.

**How to use:** pick an item → open its file → implement → update **Status** in the item file
_and_ in this table → add a dated note in the item's Notes section.

Statuses: `todo` · `in-progress` · `done` · `deferred`

## The Pilot build (north star - [pilot.md](pilot.md), learning in [pilot-learning.md](pilot-learning.md))

One generic autonomous loop: sense (server-compiled agenda) → decide (against the user's
instructions) → act (delegate to workers) → record (journal) → exit; the host orchestrator re-injects
perpetually. Implementation runs on branch `feat/pilot` per the approved 2026-07-15 plan.

| Status | Milestone | Hook |
| --- | --- | --- |
| done | M1 - Pilot spine | instructions → agenda → claim → cycle → journal; orchestrator + host pairing |
| done | M2 - Away-proof | web push, phone-answerable questions, unattended nights |
| done | M3 - Full surface | inbox review, outreach + warm path, self-promotion, 7am digest |
| done | M3.5 - Interview autonomy | invite → reply approval card + auto prep sheet |
| done | M4 - Event wake + proactive | SSE wake, stuck-run heuristics, strategy review, board health |
| done | M5 - Learning-ready capture | correction capture, journal export, subjectKey conventions |

## Independent tracks

| Status | Item | Hook |
| --- | --- | --- |
| todo | [Dashboard aggregates](t1-dashboard-aggregates.md) | tiles/strip count a 100-row page; needs `/campaigns/stats` |
| todo | [Agent eval laboratory](t1-eval-lab.md) | replayable ATS fixtures, graded scorecard; the autonomy immune system |
| todo | [Step telemetry](t1-step-telemetry.md) | OTel GenAI metrics per job |
| todo | [MCP tool server](t3-mcp-tool-server.md) | typed tools generated from Zod contracts |
| todo | [FormIR + answer ledger](t3-formir-answer-ledger.md) | canonical form IR, provenance, receipts |
| todo | [ATS playbooks](t3-ats-playbooks.md) | replay+verify instead of exploring; fleet-shared |
| todo | [Pre-flight question harvesting](t3-preflight-harvest.md) | batch dry-run; one up-front answer form |
| todo | [Scout/apply pipeline](t3-scout-apply-pipeline.md) | parallel scoring lane ahead of sequential applies |
| todo | [Token efficiency](t3-token-efficiency.md) | extractors, model routing, tailoring memoization |
| todo | [Natural writing skill](t3-natural-writing.md) | letters read as AI; pattern lists can't fix generate-then-patch |
| todo | [Shared job index](t4-shared-job-index.md) | collective crawl; network effect |
| todo | [Ghost-job detection](t4-ghost-job-detection.md) | fleet outcomes spot ghost postings |
| todo | [Browser session vault](t4-session-vault.md) | encrypted cookie jars via DEK infra |
| todo | [Salary benchmark & negotiation](t4-salary-benchmark.md) | digests → market benchmark → offer analysis |
| todo | [Budget governor](t4-budget-governor.md) | token burn-down, auto-degrade (budget surface lands in the Pilot agenda from M1) |

## Done

| Item | Hook |
| --- | --- |
| [Green CI](t0-green-ci.md) · [Inbox SSE tenant leak](t0-inbox-sse-leak.md) · [Rate limiting](t0-rate-limiting.md) · [Prompt-injection boundary](t0-prompt-injection.md) · [Scratch-file discipline](t0-scratch-files.md) | Tier 0 fixes, 2026-07-12 |
| [API core tests](t1-api-core-tests.md) | 8 suites, recordJobResult via fake-prisma, no DB in CI (07-15) |
| [Admin pages](t1-admin-pages.md) | 3-role ladder + adminGuard |
| [Public jobs page](t3-public-jobs-page.md) | public /jobs, SEO funnel, tech facets (07-13) |
| [Public "hire me" page](hire-me-page.md) | public /u/[username] portfolio + heatmap, /leaderboard, OG images (07-19) |

## Deferred / rejected

See [deferred.md](deferred.md) - decisions with reasons (incl. the 2026-07-15 Pilot
consolidation supersessions), so they aren't re-litigated.

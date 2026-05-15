# JobPilot Web App — F2 Implementation (Stage 2)

## Context

The current web app (`src/web/`) is a default-MUI light-themed admin: indigo+slate
palette, 8 resource-oriented nav items, tab-heavy forms, terminal as a hidden
bottom drawer. Completing one job application means hopping Resumes → Queue →
Terminal → Runs → Applications.

After exploring four directions visually (Stage 1: option-a-linear, option-b-editorial,
option-c-kanban, option-e-inbox under `design-demos/`) and a refinement pass
(Stage 1.5: `option-f2-cockpit-calm.html`), the chosen direction is **F2 — Agent
Cockpit · Calm**: a kanban-first home page with a collapsible right dock that
houses Pilot (agent voice + chat), Terminal, and Events tabs.

**User constraints for Stage 2 (production):**

1. **Restrain the demo flourishes.** The refined F2 demo introduces grain
   overlay, scanlines, brackets, serial number, Fraunces italic body, dual
   violet+chartreuse accents, hue-rotating orb. *Don't ship most of that* — keep
   the calm cockpit *idea* but lose decorative noise that distracts from the
   work.
2. **Scale matters.** Real users will have **100s–1000s of jobs** across
   stages. A naive kanban that renders every card kills performance and is
   unreadable. Address this as a first-class design problem.
3. **One clean dark theme.** Dark only. One sans (Geist via `next/font`), one
   mono (Geist Mono) for IDs/timestamps. No serif italic body.

---

## Design rules (production-tightened from refined F2)

**Palette** — minimal, mostly grayscale with one accent.
- Surfaces: `--bg #07090F` · `--surface #111726` · `--surface-2 #161D2E` ·
  `--border #1E2638` (hairline borders, no shadows).
- Text: `--text #E9EDF5` · `--text-dim #94A3C5` · `--text-faint #5D6886`.
- Accent (single): violet `#A78BFA` — used for primary CTAs, active state, agent
  presence, live-card border.
- Stage colors: desaturated, *only* used as small 7px dots in column headers
  (not as fill backgrounds): discovered `#6478D8`, queued `#5DA8E0`, applying
  `#A78BFA`, submitted `#6FBC8E`, replied `#F5C2A4`.
- **No chartreuse co-accent. No peach beyond replied dot. No gradient buttons in
  production** — keep gradient only on the small Pilot orb (agent identity).

**Typography** — Geist + Geist Mono, sans only.
- Body: Geist 400, 13px, line-height 1.5.
- H1 (page title): 18px / 500.
- Card role: 13px / 500. Company: 11px Geist Mono / 400.
- IDs, timestamps, board chips, match score, agent step labels: Geist Mono.
- **Drop Fraunces.** Agent's inline thought renders in plain Geist 13px italic
  (CSS italic is enough to mark it as "voice"). No additional font load.

**Motion** — calm, purposeful, never decorative.
- Orb: 6s breath. **No hue rotation in prod** (felt clever, reads as restless on
  long sessions).
- Live-card progress: slow left-to-right shimmer (3s).
- Column reveal stagger: keep at 40ms increments, fade + 4px translate.
- Inline thought bubble: 320ms fade-in.
- **Drop** scanlines, grain overlay, terminal brackets, decorative serial
  number.

**Spatial** — keep what's load-bearing.
- Live card pulls 4px up (`translateY`) so the active column visibly leans in.
- Hairline connector from role title down to thought bubble: keep.
- Logo glyph: simple `◇` sigil instead of textual "J" (stays — single character,
  zero overhead).
- **Drop** the gradient bottom-border on topbar; use plain `--border`.

---

## Scale strategy (kanban at 100s–1000s jobs)

A 5-column board with 200+ cards per column is unworkable rendered naively.
The plan uses four layered techniques:

### 1. Per-column virtualization
Every column body is a virtualized scrollable list using
**`@tanstack/react-virtual`** (new dependency). Only the visible window of cards
mounts; scrolling is GPU-smooth even at 5000 items.

### 2. Server pagination + infinite query
`GET /api/pipeline?stage=X&cursor=Y&limit=50` returns 50 jobs per request.
React Query `useInfiniteQuery` per column. Scroll-end triggers next page.
First paint: 50 × 5 = 250 cards max, regardless of total volume.

### 3. Smart defaults that hide stale jobs
- Default date filter: **last 30 days**. Older jobs hidden until user opens
  filter bar.
- `Submitted` older than 60 days with no reply → archived (still queryable, not
  shown by default in the column).
- `Discovered` column (search results) shows only the **top 20 by match score**
  with a "Show all 247 → table view" link; raw discovery results live in the
  table fallback, not the board.

### 4. Table fallback view
A board/table toggle in the topbar. Table view uses **TanStack Table +
virtualization** for power users scanning hundreds of submitted jobs at once
(sort by date, board, match; bulk actions; CSV export). Same data, different
read pattern. Same filter bar drives both.

### 5. Column header summarization
Each column header shows count + a tiny mono breakdown (e.g.,
`Submitted · 487 · 12 today`). Reduces the need to scroll the column to know
volume.

### 6. Card density
Two density modes: **comfortable** (current F2 cards) and **compact** (single
line: role · company · match% · time). Toggle in topbar. Defaults to comfortable
under 100 total jobs, compact over 100.

---

## Reusable components — reduce duplication

A guiding principle for this rebuild: **before writing markup in a feature
component, check if it should be a primitive in `src/web/src/components/ui/`**.
Each item below is something the current codebase repeats (or will repeat
across Pipeline/Settings/Resume), so factor it once.

**Primitives to introduce** (place under `src/web/src/components/ui/`):

- `feedback/pulse-dot.tsx` — small colored dot with optional pulsing halo.
  Used by: agent status (dock strip + dock head), live-card pulse, board
  credential validity, run live state, stage dots in column headers, inbox unread
  indicators. *Variants*: `size` (xs/sm/md), `tone` (violet/green/amber/peach/
  muted), `pulsing` (bool).
- `display/mono-label.tsx` — Geist Mono text fragment with optional accent
  color and uppercase/letter-spacing presets. Used by: eyebrows, IDs,
  timestamps, "Submitted · 47" counts, agent step labels. Replaces ~30 ad-hoc
  inline mono spans.
- `display/match-score.tsx` — the `★ 87%` pattern with consistent dot/bar
  visualization. Used by every job card and table row.
- `display/board-chip.tsx` — small mono chip showing a board name. Used by
  cards, tables, filter bar, detail pane.
- `display/stage-dot.tsx` — single source of truth for stage color + label
  mapping. Replaces scattered stage chip styling in
  `stage-chip.tsx` + ad-hoc colors in features. Exports `STAGE_DOT_COLOR` and
  `STAGE_LABEL` constants.
- `display/pilot-orb.tsx` — the conic-gradient orb. Used in dock strip, dock
  head, agent thought bubble lead, and (optionally) inline mentions of "Pilot".
  Props: `size`, `breathing` (bool), `liveDot` (bool).
- `feedback/agent-status-indicator.tsx` — composes pulse-dot + label for
  consistent agent-state display (idle/working/awaiting-input/error). Used in
  dock strip, mobile bottom sheet header, and any future "agent quick view"
  surfaces.
- `data/virtual-list.tsx` — thin wrapper around `@tanstack/react-virtual` with
  the standard scrollparent + measure setup. Used by every pipeline column and
  the table fallback.
- `data/virtual-table.tsx` — thin wrapper around TanStack Table +
  `@tanstack/react-virtual` row virtualization, with a stable column-config
  prop shape. Used by pipeline-table.tsx and any future "scan large dataset"
  views (applied export, runs history).
- `layout/density-toggle.tsx` — comfortable/compact button group, persists
  preference to localStorage. Used by Pipeline today; reusable wherever a card
  list has both modes (could later: Resumes list, Boards list).
- `layout/detail-pane.tsx` — right-side slide-over pane with a header,
  scrollable body, and footer actions slot. Used by: pipeline card detail,
  job-detail-pane, run timeline drill-in, future inbox message detail.
- `layout/section-anchor-nav.tsx` — sticky left-side nav listing section
  anchors, highlights the current section via IntersectionObserver. Used by
  Settings, Resume editor, and any future long-form scroll page.
- `layout/agent-dock-tabs.tsx` — tab-strip primitive sized for the 380px dock.
  Reusable across pilot/terminal/events tabs and any future dock tab.
- `data/filter-bar.tsx` (already exists; extend) — accept slot-style filter
  children so Pipeline filter bar, Inbox filter bar, and Resumes filter bar
  share spacing, responsive collapse, and clear-all behavior.
- `feedback/empty-state.tsx` (already exists; extend) — add `variant`
  prop for `column` (small, inline) vs `page` (centered, large) and require a
  CTA action prop (no more dev-leaky empty states).
- `data/infinite-scroll-sentinel.tsx` — IntersectionObserver-based sentinel
  that calls `fetchNextPage()` when visible. Used by pipeline columns and any
  future infinite-loaded list.

**Existing primitives to consolidate**:

- `ui/form/*` form fields are good — leave alone, but use them in the new
  Settings sections (don't write new inputs).
- `ui/display/stat-card.tsx` — restyle for dark, then reuse in the future
  Pipeline summary header (currently in Dashboard, which is being merged).
- `ui/feedback/confirm-dialog.tsx` — reuse, don't fork.

**Feature-level shared components**:

- `features/pipeline/pipeline-card.tsx` is the single card definition; both
  the board view and the table view (in its expanded row form) use it. Don't
  fork.
- `features/agent-dock/agent-input.tsx` is the only chat input; the future
  "ask Pilot" button on the topbar opens the dock and focuses this same input.
- `features/pipeline/job-detail-pane.tsx` is the only detail surface for a
  job; legacy Applications detail page disappears in favor of this.

**Rule of thumb**: if the same JSX shape appears in 2+ places, extract it.
This is doubly important now because the F2 visual language (orb + violet
accent + mono labels + hairline borders) recurs everywhere — duplicated
styling will drift.

---

## File-by-file changes

### Theme (foundational — do first)
- `src/web/src/theme/palette.ts` — rewrite for dark-only. Surfaces, text,
  border, single violet accent, 5 muted stage dots.
- `src/web/src/theme/tokens.ts` — radii (6/8/10/12), motion timings (200/280/380
  cubic-bezier-out), shadow tokens to `none` (hairlines only).
- `src/web/src/theme/typography.ts` — wire Geist via `next/font/google`. Drop
  unused variants; tighten to 6 sizes.
- `src/web/src/theme/theme.ts` — MUI component overrides: Button (no shadow, no
  uppercase, primary uses violet), Chip, Card, TextField, DataGrid → keep but
  restyle. Switch `mode: "dark"`.
- `src/web/src/theme/augment.d.ts` — adjust if removing custom typography
  variants (`body2Muted` etc.).
- `src/web/src/providers/theme-provider.tsx` — drop CssBaseline overrides that
  assumed light.

### App shell
- `src/web/src/components/layout/app-shell.tsx` — grid `56px 1fr auto` where
  the right column is the agent dock (56 collapsed / 380 expanded).
- `src/web/src/components/layout/sidebar.tsx` — rename to `rail.tsx`. Strip back
  to icon-only 56px rail with hover labels; active state = small violet bar +
  surface fill.
- `src/web/src/components/layout/nav-group.tsx`, `nav-item.tsx` — repurpose for
  the rail; provide tooltip on hover.
- `src/web/src/components/layout/shell-config.ts` — collapse nav to **5 items**:
  Pipeline · Inbox · Resumes · Boards · Settings. (Drop Dashboard, Applications,
  Queue, Runs — they merge into Pipeline.)

### New: agent dock (replaces terminal-drawer)
Directory `src/web/src/components/features/agent-dock/`:
- `agent-dock.tsx` — outer pane, reads `expanded` state from `AgentProvider`,
  swaps between strip / panel layouts.
- `dock-strip.tsx` — 56px collapsed view: breathing orb + status dot + vertical
  "Pilot" label + expand button.
- `dock-panel.tsx` — 380px expanded view: tab nav, agent head, current-focus
  card, chat input.
- `dock-tab-pilot.tsx` — current-focus thought card + chat input (the calm
  default tab).
- `dock-tab-terminal.tsx` — moves the existing xterm.js iframe into this tab.
  Reuses `src/web/src/components/features/terminal/terminal-panel.tsx`.
- `dock-tab-events.tsx` — structured event log (from SSE).
- `pilot-orb.tsx` — small reusable conic-gradient orb (used in rail logo too?
  No — logo uses sigil `◇`, orb only in dock).
- `agent-input.tsx` — chat-style input with kbd hints; on submit calls
  `useAgent().inject(text)`.

### Provider rename + extend
- `src/web/src/providers/terminal-provider.tsx` → `agent-provider.tsx`.
  - State: `expanded`, `activeTab` ('pilot'|'terminal'|'events'), `currentFocus`
    `{ runId, jobKey, step, message } | null`, `agentStatus`
    `'idle'|'working'|'awaiting-input'|'error'`.
  - Effects: subscribe to `/api/agent/stream` (SSE) to update `currentFocus` +
    `agentStatus`.
  - Methods: `expand()`, `collapse()`, `setTab()`, `inject(cmd)` (reuses
    existing terminal HTTP client `src/web/src/lib/terminal.ts`).
- Update `src/web/src/components/features/queue/queue-run-button.tsx` and
  `runs/autopilot-run-button.tsx` to use `useAgent()` instead of `useTerminal()`,
  and to expand the dock on trigger.

### New page: Pipeline (the new home)
- `src/web/src/app/page.tsx` — RSC, renders `<PipelineView />`.
- New dir `src/web/src/components/features/pipeline/`:
  - `pipeline-view.tsx` — `'use client'`. Reads URL filters (via `nuqs`),
    chooses board vs table layout.
  - `pipeline-board.tsx` — 5-column kanban; each column is a
    `<PipelineColumn />`.
  - `pipeline-column.tsx` — virtualized via `@tanstack/react-virtual`. Uses
    `useInfiniteQuery` for cursor-based pagination. Header shows count + tiny
    "X today" breakdown.
  - `pipeline-table.tsx` — TanStack Table fallback, virtualized rows, sortable,
    bulk-select for archive/delete.
  - `pipeline-card.tsx` — single job card. Density-aware
    (`comfortable | compact`). Live-state variant shows inline
    `<AgentThoughtBubble />`.
  - `agent-thought-bubble.tsx` — reads `currentFocus` from `useAgent()`,
    renders the inline thought (plain italic Geist, not Fraunces).
  - `pipeline-filter-bar.tsx` — date range, board multi-select, search, density
    toggle, board/table toggle. All state in URL via `nuqs`.
  - `pipeline-empty-state.tsx` — per-column empty states with CTAs (Add
    boards / Add URLs / etc.).
  - `job-detail-pane.tsx` — slide-over right pane when a card is clicked.
    Replaces standalone Applications detail page.

### API
- New: `src/web/src/app/api/pipeline/route.ts` — `GET` with query params
  `stage`, `cursor`, `limit` (default 50), `dateFrom`, `dateTo`, `board[]`,
  `search`, `matchMin`. Returns `{ items, nextCursor, totalCount, todayCount }`.
  Internally unions Applied / QueueEntry / RunJob tables by stage. Reuses
  `src/web/src/lib/matching.ts` for any fuzzy lookups.
- New: `src/web/src/app/api/agent/stream/route.ts` — SSE endpoint pushing
  `{ runId, jobKey, step, message, status }`. Reuses `src/web/src/lib/sse.ts`
  broker. Wired to PATCH events on `/api/runs/[id]` and
  `/api/runs/[id]/jobs/[jobKey]`.
- Existing endpoints: keep `/api/applied`, `/api/queue`, `/api/runs/*` for
  back-compat (skills still POST/PATCH to them), but pages stop reading from
  them directly.

### Settings (consolidate Profile + Credentials)
- `src/web/src/app/settings/page.tsx` — new route. RSC.
- New: `src/web/src/components/features/settings/settings-page.tsx` —
  scroll-and-anchor layout. Left sticky nav with section anchors (Personal ·
  Address · Work auth · EEO · Autopilot · Email · Credentials).
- Reuse: `personal-tab.tsx`, `address-tab.tsx`, etc. as **section components**,
  not tabs — drop their tab wrappers, render all stacked.
- Delete `src/web/src/app/profile/page.tsx` (or redirect to `/settings`).

### Resume editor
- `src/web/src/app/resumes/[id]/page.tsx` — drop tab nav; render all sections
  stacked with a sticky left section list (same pattern as Settings).
- `src/web/src/components/features/resumes/resume-editor.tsx` — refactor: the
  6 `editor/*-tab.tsx` files become `*-section.tsx` rendered in sequence.

### Pages to delete or redirect
- `src/web/src/app/applications/page.tsx` → redirect to `/?stage=submitted`
- `src/web/src/app/applications/[id]/page.tsx` → redirect to
  `/?stage=submitted&job=<id>` (opens detail pane)
- `src/web/src/app/queue/page.tsx` → redirect to `/?stage=queued`
- `src/web/src/app/runs/page.tsx` → redirect to `/?stage=applying`
- `src/web/src/app/runs/[id]/page.tsx` → keep for now; linked from a
  card's detail pane as "view run timeline".
- `src/web/src/app/profile/page.tsx` → redirect to `/settings`.

### UI primitives — restyle, don't rewrite
- `src/web/src/components/ui/display/stage-chip.tsx` — switch to small dot +
  label pattern, new colors. No filled pill backgrounds.
- `src/web/src/components/ui/layout/page-header.tsx` — simplify; pipeline page
  has its own topbar.
- `src/web/src/components/ui/data/data-table.tsx` — restyle for dark; or
  replace with TanStack Table wrapper for virtualization (decide during impl).
- New: `src/web/src/components/ui/feedback/pulse-dot.tsx` — reused for status
  indicators (agent, board credential validity, etc.).

### Empty states
- Replace dev-leaky text like "Run `bun db:seed`" with proper CTAs:
  - Boards empty → "Add your first board" with shortcut to common ATS.
  - Pipeline empty → "Connect a board to start discovering jobs."
  - Resumes empty → "Upload a PDF or start from scratch."

---

## New dependencies

- `geist` (or `next/font/google` Geist — Next 16 supports both)
- `@tanstack/react-virtual` — column + table virtualization
- `@tanstack/react-table` — table fallback view
- `nuqs` — URL state for filters
- *No* `@dnd-kit` for v1; drag-between-stages isn't core to the workflow yet.

---

## Critical existing files to reuse

- `src/web/src/lib/sse.ts` — SSE broker for agent stream
- `src/web/src/lib/terminal.ts` — terminal HTTP client (still drives the
  Terminal tab inside the agent dock)
- `src/web/src/lib/matching.ts` — Jaro-Winkler for duplicate detection
- `src/web/src/lib/api/query-keys.ts` — extend with pipeline keys
- `src/web/src/lib/db.ts` — Prisma client (libSQL adapter)
- `src/web/prisma/schema/*.prisma` — informs `/api/pipeline` query design
- `src/web/src/components/features/terminal/terminal-panel.tsx` — embed inside
  the new dock's Terminal tab

---

## Migration order

1. **Theme + fonts.** Palette/tokens/typography/theme.ts → restart, every page
   re-renders dark. Visual sanity check across existing pages.
2. **Rail + app-shell + provider rename.** Get the new 5-item nav up. Agent
   dock starts as collapsed strip only.
3. **Agent dock expanded panel + Pilot tab.** SSE wiring + chat input. No
   pipeline yet — works against existing pages.
4. **Pipeline page (board mode).** Single column rendering first, then
   virtualization, then all 5 columns. Compact density.
5. **`/api/pipeline` endpoint** wired to TanStack `useInfiniteQuery`.
6. **Inline thought bubble** on live card subscribed to `currentFocus`.
7. **Table fallback view + density toggle.**
8. **Filter bar with `nuqs`.**
9. **Settings consolidation** + delete profile page.
10. **Resume editor scroll-and-anchor.**
11. **Cleanup**: delete merged pages, redirect routes, remove unused tab
    components, update CLAUDE.md File Inventory.

Each step is independently shippable behind the dev server.

---

## Verification

Run `bun run dev` (root) which starts both terminal + web. Walk these flows
in a browser at `http://localhost:8000`:

1. **Theme sanity** — every existing page renders dark with no light-mode
   leaks. No "default MUI" looking elements left.
2. **Empty install** — fresh DB → Pipeline shows guided empty state, agent
   dock orb is calm (idle), CTA leads to /boards.
3. **Scale test** — seed 1000+ fake applications across stages (extend
   `prisma/seed/`). Open Pipeline. Verify:
   - Initial paint < 250 cards regardless of total.
   - Scrolling a column stays at 60fps (DevTools perf).
   - Switching to table view renders without freezing.
   - Filter changes update URL and refetch in one round-trip.
4. **Live run** — trigger `/jobpilot:apply` via the Pilot chat input → agent
   dock expands, Applying column shows live card with inline thought; SSE
   updates the bubble step-by-step.
5. **Settings** — open `/settings`, scroll-and-anchor nav works, save persists,
   sticky nav highlights current section.
6. **Detail pane** — click a card on Pipeline → slide-over from right (with
   dock collapsed for room), shows stage timeline, links to run if applicable.
7. **Mobile** (375px viewport) — rail becomes hamburger, agent dock becomes
   bottom sheet, kanban becomes single-column with stage selector. Filter bar
   collapses into a single button.
8. **No regression** — existing skills (`/jobpilot:apply`, `/jobpilot:autopilot`)
   still POST/PATCH successfully through unchanged `/api/applied`,
   `/api/queue`, `/api/runs/*` endpoints.

---

## History (condensed)

**Stage 1 (complete)** — produced 4 directional demos under `design-demos/`:
linear (A), editorial (B), kanban (C), inbox (E). Added two kanban hybrids:
cockpit-noisy (F) and mission-control (G). User picked F's direction.

**Stage 1.5 (complete)** — F2 (`option-f2-cockpit-calm.html`) refined per
`/frontend-design`: Geist + Fraunces, violet+chartreuse, grain/scanlines/brackets,
hue-rotating orb. Demo lands the "designed" feel — but Stage 2 above intentionally
strips most flourishes back to ship a clean production version.

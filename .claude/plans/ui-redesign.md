# UI redesign plan (apps/web)

## Context

The user picked a full redesign on 2026-11-06 from HTML mockups in `.tmp/design-lab/` (gitignored;
serve with `python -m http.server 4190` from that folder). The picked direction is variant E in the
Carbon palette. Reference files: `e-hybrid.html?p=carbon` (Pilot), `inbox.html`, `resume.html`, and
`lab.css` for the tokens.

The problems the redesign solves:
- On Pilot, the things that need the user are buried in the middle of the feed, under system noise.
- Body text is 13px, which is too small, and cards barely stand out from the page.
- Space is wasted: wide empty gutters and a right rail full of small text.
- Inbox is a table where most rows are "Irrelevant · 90% · –" and every row has a Rescan button.
- The resume editor repeats its section list twice and squeezes the PDF preview into the smallest column.

The direction:
- **Shell.** A 64px icon rail replaces the sidebar. A 64px top strip shows the page title, the agent status pill, the page's actions, and later a ⌘K jump box.
- **Pilot.** A "Needs you" queue sits in a left column and the conversation sits in the main area. Opening a parked job swaps the conversation for a detail pane with a keyboard-hinted action bar (J/K/Esc).
- **Look.** Text grows to 15px. Cards get a lighter surface (`#1A1917`). Radii shrink: cards 8px, buttons and inputs 6px, chips 4px. Buttons stay flat and lighten on hover, with no lift or glow.
- **Mobile.** Every screen must work at 390px wide.

Decisions (user, 2026-11-06):
- Carbon colors stay. Graphite was considered and dropped.
- Radii shrink as listed above.
- The UI must work well on mobile.

## Execution

- Branch `feat/ui-redesign` off `main`, no PRs. Run `verify`, then commit with the `commit` skill, once per phase.
- Each phase leaves the app working. The web app only; no API changes unless a phase says so.
- Check every phase in the running app at 1600×1000 and 390×844 (Playwright MCP; see memory "Live web checks").
- Follow `CLAUDE.md` and `.claude/rules/web.md`. Never run `biome check --write --unsafe`.

---

## Phase 1: Theme foundation

Applies everywhere at once; no layout changes.

| Area | Change |
|---|---|
| `palette.ts` | `surfaces.card` `#151413` → `#1A1917`, `elevated` `#201E1B` → `#23211E`. Add `surfaces.panel` `#121110` for queue/list columns. |
| `typography.ts` | Body text: `body1` goes from 13px to 15px, `body2` from 12px to 14px, `caption` from 11px to 12px, `button` from 13px to 14px. Muted and Strong variants follow, since they're built from these. |
| `tokens.ts` | `radii` changes from {xs 2, sm 3, md 6, lg 10} to {xs 2, sm 4, md 6, lg 8}. `controlHeights` changes from {sm 32, md 38} to {sm 34, md 40}, to fit the 15px input text. |
| Overrides | Cards and the data grid use `radii.lg`. Buttons and inputs use `radii.md`. Contained buttons lighten on hover with no lift or glow shadow. Outlined buttons become a filled secondary (`elevated` fill, `borderHi` border, which brightens on hover). |

## Phase 2: Shell

- **`Sidebar` is a fixed 84px rail with labels (user, 2026-11-06, replacing the earlier expandable sidebar).** Each entry is an icon over a short caption label, active entries get an accent tint, and the needs-you count sits on the Pilot icon. The Channels group is set off by a divider. Agent, Settings and the account avatar sit at the bottom. No collapse toggle.
- **Pilot thread** is centered beside the queue, up to 1000px wide.
- **New `TopBar` in `AppShell`.** A 64px strip with the page title, the agent status pill (with Start agent when offline), and a slot for page actions. `PageHeader` sends its title and actions into the bar. Its description stays in the page content.
- **Mobile.** The bottom `MobileNav` stays, restyled to the new tokens. The top bar shrinks to the title, an agent status dot and an actions overflow menu. `PageHeader` actions render in the page content below `sm`.
- Remove the `py` padding from the dashboard layout's top; the bar provides the spacing.

## Phase 3: Pilot

- **Desktop.** A 400px `panel` column on the left holds:
  - "Needs you": notices such as the email reconnect, questions, proposed changes and parked jobs.
  - Searches, Rules and the week summary, moved here from the right rail. The right rail and the Stealth Code banner leave the column (the banner moves to settings or a dismissible notice).
- **Main area.** The conversation and the message box. Restart notices collapse into one muted line.
- **Header.** The page header's agent, cap, week and autopilot widgets move into the TopBar as KPIs plus the Autopilot switch.
- **Parked jobs.** Selecting one shows a detail pane in the main area: why it's waiting, the answer options, the job summary and an action bar. This replaces `JobDrawer` on this page. Keys: J/K move through the queue, Enter opens, Esc returns to the conversation.
- **Mobile.** A `Chat · Needs you (n) · Overview` tab switcher at the top. Detail opens full-screen with a back button.

## Phase 4: Inbox

- **List page.** A full-width list, newest first. Rows show sender, subject, snippet, the matched application and a type badge. Irrelevant mail folds into one "N filtered out" row. Filters: All, To review, Auto, Approved, Denied. (User, 2026-11-06: no split pane, no grouping by type, since the badge already shows it.)
- **Message page.** Each message opens at `/inbox/[id]`, carrying the list's `?filter=&page=` so Back and next/previous match the list. It shows "Pilot's read" (type, confidence, reasoning, the status approving would set, and the matched application), the body, and a sticky Approve/Deny footer. Keys: J/K, A, D, Esc. After approving or denying it moves to the next message.
- **Replaces** `InboxTable` and `MessageReviewDialog`.

## Phase 5: Resume editor

- **Layout.** Full-height columns: the editor on the left, and the saved PDF on the right (from `lg` up, with no thumbnail pane, fit to width). Below `lg` the preview becomes a tab.
- **Top bar.** Resume name, Primary, Open PDF, Delete. Renaming is a field at the top of the Edit tab.
- **Tabs.** Edit · (Preview) · Variants (n) · Source PDF. Variants are a page tab, not a tab per variant: a resume can have dozens of tailored variants, with search and prune.
- **Sections.** The section index nav is removed. Empty optional sections (Publications, Awards, Certifications, Custom) become "+ Add" buttons that open the section in place.

## Phase 5b: One list pattern

Mockup: `.tmp/design-lab/lists.html`. Every record list (Pipeline tabs, Outreach contacts and messages, Documents resumes and cover letters, Upwork proposals and inbox, Inbox) uses one set of parts in `components/ui/data/`:

- `ListCard` holds a `ListHeader` (select-all plus the sort hint, which becomes a bulk bar once rows are picked), the rows, and the `PaginationFooter` ("1–25 of 303 · 25 per page ▾ · pager").
- `ListRow`: checkbox, a 36px lead square (score, initials, icon), a bold title with tags, one muted details line, columns shown only on wide screens, actions on hover, status badge, time, and a ⋯ menu. The title is a stretched link or button, so inner controls stay clickable. On phones it wraps to title, details, then badge and time.
- Toolbar: `FilterBar` in one row, a compact `SearchField`, `SelectField` with the label inside the box ("Feed **All** ▾"), and `FilterToggle` with counts. The total count sits on the right.
- Page tabs go into a third top-bar slot (`PageHeader tabs`), flush under the title. The main page buttons go in the top bar. Description lines are dropped.
- `PageShell` content is centered (the user reversed an earlier left-align).
- On Applied, the four funnel tiles become the status `FilterToggle`.
- DataGrid goes (`@mui/x-data-grid`, `DataTable`, its theme override). Admin keeps `SimpleTable`.
- The Diagnostics journal moves from cursor "Load more" to offset pages with the same footer. Only page 1 takes live prepends.

## Phase 5c: Pilot conversation

Mockup: `.tmp/design-lab/pilot.html`. A workspace, not a page: Needs you (340px) pinned against the rail, the overview (300px, from xl up; below that it sits under the queue) pinned to the right edge, and the conversation filling the middle with the thread centered at 760px. The top bar stays full width. Pilot turns get an avatar, "Pilot" and the time; the user's messages are bubbles. Each stretch of work is a card with up to four results, "Show N more" and the search tally. Three or more quiet rows in a row (past daily summaries, notes, settled questions) fold into one line. The composer is a raised card with Job links and Rules buttons, the Enter hint and a filled send button.

## Phase 6: Sweep

Check every remaining screen against the new tokens and shell at both widths: Pipeline, Analytics, Documents, Portfolio, Job boards, Settings, Upwork, Networking, Onboarding, the agent drawer, dialogs, auth, admin, and the public/marketing pages (fonts and radii only). Fix overflow and spacing.

Done 2026-11-07. Page descriptions dropped where a card already explains (Analytics, Portfolio, Job boards, Settings, Goals, Upwork profile). Page-level actions moved to the top bar (Analytics rank/share, Add board, View public page). Portfolio is settings beside a live preview. Pilot settings are one card per section. Card titles share the h4 face with form sections. Detail pages have back links and skeletons inside the page frame. Sticky side navs sit below the top bar. Landing tour panels are small copies of the app (rail, top bar, list rows, Pilot turns); leaderboard rows sit in a ListCard. Admin keeps its desktop tables.

## Phase 7: ⌘K jump (new feature)

A command palette for routes, pipeline jobs and settings sections, opened from the TopBar box or ⌘K / Ctrl+K. It's a search icon on mobile.

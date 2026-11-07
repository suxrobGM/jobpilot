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

- **`Sidebar` stays expandable (user, 2026-11-06).** Collapsed, it is the mockup's 64px icon rail: 42px tiles, tooltips, a badge dot, an active tile tinted with the accent. Expanded, it keeps labels in the same tile style. The collapse toggle and `use-sidebar-collapsed.ts` stay. The agent/terminal button and settings sit near the bottom, with the account avatar at the foot.
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

- **Layout.** Two equal columns: section cards on the left and a full-height sticky preview with its own toolbar on the right.
- **Cleanup.** Remove the section index nav. Collapsed cards show a short preview. Empty sections become "+ Add" buttons.
- **Variants.** Tailored variants become tabs next to the resume name.
- **Mobile.** An Edit/Preview switch.

## Phase 6: Sweep

Check every remaining screen against the new tokens and shell at both widths: Pipeline, Analytics, Documents, Portfolio, Job boards, Settings, Upwork, Networking, Onboarding, the agent drawer, dialogs, auth, admin, and the public/marketing pages (fonts and radii only). Fix overflow and spacing.

## Phase 7: ⌘K jump (new feature)

A command palette for routes, pipeline jobs and settings sections, opened from the TopBar box or ⌘K / Ctrl+K. It's a search icon on mobile.

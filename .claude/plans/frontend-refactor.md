# Frontend refactor plan (apps/web)

## Context

The 2026-11-04 review of `apps/web` (535 files, 28.5k lines) found:

- **Two ways of loading data.** Some pages fetch in server components, most fetch through client queries. This caused a double fetch on campaign detail, and a networking dialog that has to call both `router.refresh()` and invalidate the query cache.
- **Four loading/error patterns.** Some errors show twice, some spinners never stop, and some empty states appear while data is still loading.
- **Duplicated primitives** in `ui/` and the features.
- **Hand-rolled code** that MUI or the theme already provides.
- **About 10 user-facing bugs.**

The goal is one data model, one query-state component, one live-update hook, theme defaults instead of repeated props, and a tidier route and folder structure. User behavior stays the same apart from the bug fixes.

Decisions (user, 2026-11-05):
- Dashboard data uses the client query cache only. Server fetching stays for public/SEO pages and `generateMetadata`.
- Include the route moves: `/account/security` moves to `/settings/security`, and a `(public)` route group gets one shared layout.
- Busy buttons use MUI's `loading` prop instead of label swaps.
- Resume events are also published on the user-level workspace channel, so the resume list opens one connection.

## Execution

- Branch `refactor/web` off `main`, no PRs. This matches the backend refactor.
- At the start, copy this plan to `.claude/plans/frontend-refactor.md` and add a project memory pointer.
- One or more commits per phase via the `commit` skill. Run the `verify` skill before each commit. No co-author trailers.
- Each phase leaves the app working. Phases 4 and 7 touch the API, so the web and API deploy together for those.
- Follow `CLAUDE.md` and `.claude/rules/web.md`. Never run `biome check --write --unsafe`.

---

## Phase 0: Bug fixes (small, independent)

| Bug | File | Fix |
|---|---|---|
| Campaign tiles count one page only | `features/workspace/dashboard/stat-tiles.tsx`, `attention-strip.tsx` | No campaign aggregate exists. Add `GET /api/campaigns/summary` (active count, networking replies, drafts awaiting review) with the `add-api-route` skill, plus a `campaignQueries.summary` factory. The API change ships in batch 1. |
| "No campaigns yet" shows under Now running | `workspace/dashboard/campaign-groups.tsx:37` | Count the running group too, or move the empty state to `overview-panel.tsx` across all groups. |
| Keywords field eats commas | `resumes/editor/projects-section.tsx:82-90` | Reuse the free-text `Autocomplete` chip input from `skills-section.tsx:32-43`. |
| Auth forms show errors twice | `auth/forgot-password-form.tsx`, `reset-password-form.tsx`, `confirm-email-change-view.tsx`, `verify-email-view.tsx` | Pass `showErrorToast: false`. |
| Toast plus inline error | `pilot/journal/cycle-cost.tsx`, `pilot/instructions/searches-list.tsx`, `research-section.tsx` | Drop `errorMessage`. Phase 3 removes the option entirely. |
| Spinner never stops on error | `resumes/resume-detail.tsx:66`, `resumes/detail/suggested-rewrite-card.tsx` | Split the loading and error branches. |
| Journal reset invalidates `pilot.all` | `pilot/journal/journal-feed.tsx:53` | Invalidate journal, state and runs only. |
| Onboarding maps `email`, but the field is `contactEmail` | `onboarding/validation-issues.ts:6` | Rename the key. Derive the step index from `STEPS`. |
| Onboarding may overwrite saved settings | `onboarding/onboarding-wizard.tsx:65` | Confirm first. If true, seed the form from `userQueries.detail()`. Also remove the duplicate `invalidateQueries()` at :56-58. |
| Two identical alerts | `onboarding/resume-upload-step.tsx:99-117` | Show the retry alert only after a timeout. Fix the copy. Drop the unused `"uploading"` state. |
| Check-interval input min 1, schema min 5 | `pilot/instructions/limits-section.tsx:45` | Set `min: 5`. |
| Deleting a campaign or application goes to `/` | `campaigns/detail/actions-bar.tsx:64`, `applications/application-detail.tsx:90` | Go to `/workspace` and `/workspace/applications`. |
| Application shows the raw `campaignId` | `application-detail.tsx:164` | Link to the campaign. |
| Variable named `window` | `portfolio/leaderboard-view.tsx:34` | Rename to `range`. |
| `robots.ts` misses `/account` | `app/robots.ts` | Add it. In Phase 7, check the `/settings` entries. |

## Phase 1: Theme defaults and theme cleanup

Files: `src/theme/overrides/*.ts`, `src/theme/typography.ts`, `src/theme/tokens.ts`, `src/theme/theme.ts`.

1. **Default sizes.** Set `MuiChip` `defaultProps: { size: "small" }` and remove the 54 `size="small"` props. Set `MuiTable` `defaultProps: { size: "small" }` and remove 6.
2. **External links.** In `overrides/link.ts`, swap `NextLink` for an `AppLink` adapter in a new `theme/app-link.tsx`. It renders NextLink for internal hrefs. For `^https?:` hrefs it renders `<a target="_blank" rel="noopener noreferrer">`. Use it for both `MuiLink.component` and `MuiButtonBase.LinkComponent`. Then remove about 30 hand-written `target`/`rel` pairs, e.g. `resumes/resumes-list.tsx:169`, `cover-letters/[id]/page.tsx:55,66`, `pilot/attention/question-card.tsx:46`. `ExternalLink` keeps only its truncation role. Fix the contradictory comments in `marketing/sections/trust.tsx:52` and `docs/mdx-elements.tsx:38`.
3. **Busy buttons.** `ui/form/tanstack/submit-button.tsx` sets `loading={isSubmitting}`. Replace the 14 `isPending ? "Saving…" : …` label swaps with `loading={x.isPending}` and a fixed label, e.g. `auth/login-form.tsx:61`, `settings/settings-content.tsx:146`, `inbox/inbox-toolbar.tsx:49`.
4. **Icon sizes.** Replace the 22 MUI `fontSize="small"` icons with the theme's `sm`/`md` (`overrides/misc.ts:54`). Use `md` for 1.25rem-ish icons in menus, `sm` inline.
5. **Dividers.** Standardize on `borderColor: "divider"` or `<Divider />`. Replace the `` `1px solid ${theme.palette.line.divider}` `` strings (7, e.g. `agent-dock/dock-panel.tsx:54`, `layout/mobile-nav.tsx:94`).
6. **Dead theme code.** Delete `gradients`, `shadows.sm`, the Card `live` variant and the empty `tableBodyOverrides`.
7. **Font sizes on the scale.** Table, menu, autocomplete, tab and grid cells move from 0.875rem to the body1/body2 sizes. Put the shared table-head size in one constant for `table.ts` and `data-grid.ts`. Share the menu/autocomplete option style through a helper beside `control-box.ts`.
8. **Typography spreads.** Build each Muted/Strong variant from its base by spreading. Fix the stale comment at line 13.
9. **Derived colors.**
   - `dialog.ts:27` uses `alpha(surfaces.base, 0.6)`.
   - `theme.ts:11-12` `contrastText` comes from palette constants.
   - Raw rgba in `button.ts` and `layout/rail.tsx:43,46` moves to `shadows_custom` tokens.
10. **Table cells.** The 6 `TableCell` `fontWeight: 600` uses become `body2Strong` children. This also covers `applications-table.tsx:47`.

## Phase 2: UI kit consolidation

New and changed primitives go in `src/components/ui/`.

1. **One stat card.** Merge `features/analytics/stat-tile.tsx` into `ui/display/stat-card.tsx`: add `accent`, drop the unused `trend`. Update the 12 `StatTile` callers. Delete the `statLabel` typography variant if it ends up unused. `networking-board.tsx:158-172` maps over an array instead of five copies.
2. **`SectionCard` `eyebrow` prop.** Replace the Card + eyebrow + h5 blocks in `analytics/applications-timeline-chart.tsx`, `status-breakdown-chart.tsx` and `top-boards-list.tsx`. The shared chart empty block becomes `EmptyState`.
3. **New `SimpleTable` in `ui/data/simple-table.tsx`.** It renders on the server and takes typed columns. Use it in the 4 admin tables, `boards/boards-content.tsx` and `workspace/applications/applications-table.tsx`. Its rows can be links (`component={Link}`).
4. **`TooltipIconButton` handles any button.** Add a `TooltipButton` in `ui/buttons/` built on the same disabled-span logic. Use it in `security/connected-accounts-card.tsx:82` and `settings/sections/oauth-client-card.tsx:192`. Use `TooltipIconButton` at `dock-strip.tsx:45,51`, `journal-feed.tsx:120` and `layout/feedback-menu.tsx:17`.
5. **Real buttons.** Replace the hand-built buttons with `ButtonBase` or `IconButton`: `agent-dock/dock-strip.tsx:24`, `docs/docs-mobile-nav.tsx:39`, `ui/layout/section-anchor-nav.tsx:95`. Use `Accordion`, already themed, for `pilot/journal/cycle-timeline.tsx:96-129` and `pilot/attention/needs-attention.tsx:49,95`.
6. **Links instead of `router.push` for navigation.** Use `LinkButton`, or `CardActionArea` / `TableRow` with `component={Link}`. Sites:
   - `campaign-groups.tsx:40,53`
   - `resumes-list.tsx:71`
   - `upwork/proposals/proposals-list.tsx:51`
   - `auth/magic-link-view.tsx:54`
   - `jobs/active-filters.tsx:56`
   - applications rows (via `SimpleTable`)

   Add a `campaignHref(id)` helper in `utils/routes.ts` for the 6 copies. Type `NavItem.href` as `Route` in `layout/shell-config.ts` and drop the casts.
7. **Use what the kit already has.**
   - `DropdownMenu` in `layout/feedback-menu.tsx` and `profile/account-menu.tsx`.
   - `StickyFooter` in `settings/settings-content.tsx:128-138`.
   - `RelativeTime` for the 16 hand-written `formatRelativeTime(x) ago`, e.g. `pilot/attention/needs-attention.tsx:43`, `upwork/inbox/inbox-list.tsx`.
   - `ExternalLink` in `campaigns/detail/jobs-table.tsx:65`.
   - `SelectField` in `applications/status-transition-dialog.tsx:39`, `jobs/job-sort-controls.tsx:49,65`, `agent-dock/dock-panel.tsx:129`.
   - `SearchField` in `resumes/detail/variants-panel.tsx:125-139`.
   - `LabelValue` instead of `ReadonlyField` in `upwork/profile/profile-review.tsx`.
   - `body2Muted` for `color="textSecondary"`.
   - `CardContent` instead of Card padding by hand (`jobs/job-filters.tsx:58`, `upwork/inbox/inbox-list.tsx:115`).
   - Themed Card or Paper `panel` instead of `variant="outlined"` (3 sites).
   - `useClockTick` (`hooks/use-clock-tick.ts`) in `pilot/overview/use-next-wake.ts`, replacing its own 30s interval.
8. **Copy helper.** Extract `useCopy()` from `ui/display/copy-field.tsx`. Use it in `upwork/proposals/proposal-detail.tsx:77`.
9. **Skeletons.** Replace the 20 raw `<Skeleton>` fallbacks with `DetailSkeleton heights={[…]}`, e.g. `app/(dashboard)/campaigns/new/page.tsx:22`, `pilot/overview/overview-tab.tsx:33-36`, `app/(admin)/admin/overview/page.tsx`. `AuthFormSkeleton` stays.
10. **One status registry.** New `ui/display/status-styles.ts` with `{ color, label }` per domain value: application, campaign, campaign job, networking, promotion, cycle, Upwork proposal/inbox/profile, cover-letter source, listing, role. One `StatusChip domain=… value=…` on top of `ColorChip`.
    - Delete the scattered maps: `lib/terminal.ts:13`, `campaigns/campaign-status-chip.tsx`, `upwork/proposals/proposal-status.ts`, `upwork/inbox/inbox-kind.ts` and others.
    - Labels are title case. Raw slugs like `auto_apply` and `needs_user` get labels, including campaign `source` (`detail/header-card.tsx:54`, `campaign-row.tsx:58`, `now-running.tsx:69`).
11. **Shared feature components.**
    - `ChecklistRow`, shared by `pilot/overview/setup-checklist.tsx` and `workspace/dashboard/profile-checklist-card.tsx`, including mailbox `needsReauth`.
    - `PauseCampaignButton`, from `actions-bar.tsx` and `now-running.tsx`, with one icon.
    - `MinScoreSlider`, from `composer/auto-apply-fields.tsx` and `detail/rescan-dialog.tsx`.
    - `OpenPdfButton`, from `resumes-list.tsx`, `header-bar.tsx` and `variants-panel.tsx`, plus a `usePrimaryResume` toggle.
    - `ProviderPicker` for the 3 Claude/Codex pickers: `install-guide.tsx`, `plugin-install-commands.tsx`, `dock-panel.tsx`. `InstallProvider` uses `TerminalProviderId`.
12. **Merge the row editors.** Generalize `features/resumes/editor/entry-list.tsx` (8 users) into `ui/form/entry-list.tsx`, with a `max` prop and aria-labels on the move buttons. Replace `FieldRowList` (`ui/form/row-list.tsx`), `settings/sections/references-section.tsx` and `salary-section.tsx` with it.
13. **Tidy `ui/` folders.**
    - `DropdownMenu` → `ui/navigation/`.
    - `EmptyState`, `DetailSkeleton`, `TableSkeleton` and `QuerySection` → `ui/feedback/`.
    - Add a `navigation/` barrel only if there are several outside importers.
    - Fix deep imports that bypass a barrel: `SectionCard` (7 sites) and `@/theme/*` (7 sites).

## Phase 3: Data layer (client cache for dashboard data)

1. **Query factories.** Turn `src/api/queries.ts` into TanStack `queryOptions()` factories with the keys built in, and delete `src/api/query-keys.ts`.
   - Each factory unwraps the Eden result through an `unwrap(result)` helper in `src/api/error.ts`, built on `toApiError`.
   - Invalidation prefixes become exported `*Keys.all` constants beside each factory. `invalidations` stays as named sets. Drop the dead `dashboard` namespace, which nothing queries, and the unused `coverLetters.detail` unless step 4 uses it.
   - Keep the comments that explain why: task-list never invalidated, sorted journal filters, `OPTIONS_PAGE`.
2. **Replace `useApiQuery`.** Its 57 call sites use `useQuery(factory(...))`. Delete `api/hooks/use-api-query.ts` and its `errorMessage` toast. `useApiMutation` stays, since its toast and `invalidate` options earn their place.
3. **`QuerySection` takes the query.** New signature: `<QuerySection query={q} isEmpty={(data) => …} empty={…} errorTitle=…>{(data) => …}</QuerySection>`.
   - Adopt it everywhere a query feeds a section. Hand-rolled examples: `campaigns/campaign-detail.tsx:54-68`, `analytics/analytics-view.tsx`, `settings/sections/credentials-section.tsx:91-124`, `portfolio/portfolio-settings.tsx:149-155`.
   - Also the lists that show empty while loading: `upwork/inbox/inbox-list.tsx`, `upwork/proposals/proposals-list.tsx`, `boards/boards-content.tsx`, `workspace/applications/applications-panel.tsx`.
   - Fix the details that show "not found" on a failed request: `application-detail.tsx:112`, `proposal-detail.tsx:68`.
   - `DataTable` callers pass `errorTitle` and `emptyMessage`, e.g. `inbox-content.tsx`, `cover-letters-table.tsx`.
4. **Move dashboard server fetches to the client cache.**
   - `campaigns/[id]`: keep the `cache()` fetch for `generateMetadata` only. The header moves into `CampaignDetail` and reads the query, so SSE updates the title.
   - `networking/messages`: becomes a client list with `usePaginationParams` and `PaginationFooter`. Remove `router.refresh()` from `networking/networking-message-dialog.tsx`; invalidation alone is enough.
   - `cover-letters/[id]`: becomes a client `CoverLetterDetail` with a new `coverLetterQueries.detail`.
   - `networking/contacts`: same treatment.
   - Admin `boards`, `listings`, `pilots`, `users`, `overview`: client components with URL-backed search and paging. Drop `router.refresh()` from `admin/*-actions.tsx` and `role-menu.tsx`. Failed fetches stop calling `notFound()`.
   - The pages stay server components that render only the frame (web.md).
5. **Journal paging.** `pilot/journal/journal-feed.tsx` uses `useInfiniteQuery` with a `pilotQueries.journal` infinite factory. Delete the local `pages` state. `appendJournalEntry` writes into the infinite cache. Rename `use-journal-live.ts` to `journal-cache.ts`.
6. **Session hook.** In `hooks/use-auth.ts`, `useSession` returns `user: AuthUserDto | null` and no longer exposes `meQuery` unless a caller needs it.
7. **Avoid one-page totals.** Every `campaignQueries.list()` call that derives a count either uses an aggregate or is clearly scoped to one page.

## Phase 4: Live updates and local services

1. **Move and slim the SSE hook.** Move `lib/sse/client.ts` to `hooks/use-sse-channel.ts`. Fold the internal `useEventSource` into it and drop the unused `parse`, `onError` and `onParseError` options.
2. **New `useLiveInvalidation(channel, params, { [eventType]: keys[] }, { onReconnect: keys[] })`.** Reconnect catch-up comes built in.
   - Rewrite `pilot/pilot-live.tsx`, `workspace/workspace-live.tsx` and `campaigns/campaign-detail.tsx` on it.
   - Remove the duplicate pilot handlers in `pilot/attention/use-open-questions.ts:28-30` and `workspace/dashboard/pilot-card.tsx:50-54`. Each event is handled once per page.
   - `WorkspaceLive` dispatches by event type instead of `onMessage`, so resume events don't refetch campaigns.
3. **Resume events (contracts and API).**
   - `packages/contracts/src/sse/channels/workspace.ts`: add `{ type: "resume.updated"; resumeId: string }`.
   - API: publish it alongside the 4 `resumeChannel` publishes in `apps/api/src/modules/resume/resume.service.ts:146` and `variants/variant.service.ts:76,86,198`. The user id must be available at each site.
   - `resumes/resumes-list.tsx` subscribes once to `workspaceChannel` for `resume.updated` and drops `ResumeEventsSubscriber`.
   - The per-resume channel stays for the resume detail page.
   - Run the API tests.
4. **Terminal health.** `agent-dock/use-terminal-health.ts` becomes one shared `useQuery` (`["terminal", "health"]`, `refetchInterval` 5s, with nonce-based recheck via `refetch`), so the dock, pilot overview, workspace card and onboarding share a single poller. Move it to `hooks/` or `lib/terminal/`, since three features import it.
5. **Latest release.** `agent-dock/update/use-latest-release.ts` becomes `useQuery` with `staleTime` of 1h. Drop the `console.warn`.

## Phase 5: URL-backed filters and list frames

1. **Move list filters into the URL**, written through `usePaginationParams().setFilters` (`hooks/use-pagination.ts`). Delete the `useState` + `setPage(1)` pairs.
   - `inbox/inbox-content.tsx` (review filter)
   - `upwork/inbox/inbox-list.tsx` (kind, status)
   - `upwork/proposals/proposals-list.tsx` (status)
   - `campaigns/detail/jobs-panel.tsx` (status, search)
   - `workspace/applications/applications-panel.tsx` (search)
2. **Shared Upwork list frame.** Extract `UpworkListFrame` (filter row, clear, count, cards, `PaginationFooter`, one `PAGE_SIZE`) used by both Upwork lists.
3. **One filter control.** Use `ToggleButtonGroup` for 2–4 states (inbox, journal view, leaderboard range) and `SelectField` beyond that. Apply the rule to Upwork.
4. **Campaign jobs.** Label the job-status filter options. Rename the "Fail reason" column to "Reason". Add a pending guard to `draftProposal` (`jobs-panel.tsx:138-153`).

## Phase 6: Forms

1. **Bound fields.**
   - Fold `ui/form/text-field.tsx` and `currency-field.tsx` into their TanStack wrappers.
   - Delete the unused bound `Checkbox` and `FileUpload` (`ui/form/tanstack/index.ts`).
   - Unify on `errorText` across TextField, MultiSelect, Currency, Phone and Select.
   - Rename `Multiselect` to `MultiSelect`.
   - Fix `ToggleField`'s value type for `exclusive={false}`.
   - Trim the bound-field JSDocs.
2. **Resume editor fields.** Add an `EntryTextField` helper, Grid + TextField + `onUpdate({ ...entry, [key]: value })`, and use it for the ~20 repeated blocks in `resumes/editor/*-section.tsx`. A full TanStack migration of the editor is out of scope.
3. **Move `useState` dialogs to TanStack Form + Zod:** `resumes/new-resume-dialog.tsx`, `resumes/job-description-dialog.tsx`, `applications/status-transition-dialog.tsx` (typed via `StatusTransitionInput`). `proposal-composer.tsx` uses `z.infer` instead of its hand-written `FormValues`.
4. **Settings form.**
   - Drop the dead `setDirty` in `settings/settings-content.tsx:93`.
   - Wire `useUnsavedChangesGuard` there.
   - Move `SavedAnswersSection` out of the form; it saves on its own.
5. **Composer.**
   - Split UI copy out of `campaigns/composer/form-config.ts` into `composer/copy.ts`.
   - Drop the redundant Upwork `useEffect` (`campaign-composer.tsx:137-141`).
   - Mount the form after its data loads, matching `InstructionsTab`.

## Phase 7: Routes and folders

1. **`(public)` route group.** Move `page.tsx`, `jobs/`, `docs/`, `leaderboard/`, `u/` and `install/` under `app/(public)/`, with one layout built on `MarketingShell` (the `maxWidth` comes from the child `PageShell`).
   - Delete the duplicated `app/jobs/layout.tsx`, `u/[username]/layout.tsx`, `leaderboard/layout.tsx` and the copied `docs/layout.tsx` frame. Docs keeps only its sidebar.
   - Move `MarketingShell` to `components/layout/`.
   - URLs don't change. Re-check `src/proxy.ts` `config.matcher` and `app/public-routes.ts`.
2. **Shared OG image frame.** `app/opengraph-image.tsx` and `u/[username]/opengraph-image.tsx` share one `og-frame.tsx`. Use `SITE_URL` there and in `cta-band.tsx:18`. Replace the hardcoded GitHub URLs in `marketing-nav.tsx` and `marketing-footer.tsx` with `GITHUB_URL`.
3. **Settings absorbs security.**
   - New `app/(dashboard)/settings/security/page.tsx`; add the tab to `features/settings/settings-tabs.tsx`.
   - `/account/security` becomes a `next.config` redirect, preserving the `?oauth=` query.
   - API: `apps/api/src/modules/auth/providers.controller.ts:65,87` redirects to `/settings/security`.
   - Update `profile/account-menu.tsx:105` and `robots.ts`. Delete `app/(dashboard)/account/`.
4. **Settings folders by tab.** `features/settings/{profile,email,credentials,notifications,security}/`, with `features/security/*` moving into `settings/security/`.
   - Renames: `SettingsContent` → `ProfileSettingsForm`, `WebPushSettings` → `NotificationsCard`.
   - Inline the 14-line `EmailSection`.
   - Narrow `settings/index.ts` and `settings/sections/index.ts` to imports that are really shared.
5. **Redirects into config.** Replace the stub pages `resumes/page.tsx`, `cover-letters/page.tsx`, `documents/page.tsx` and `networking/page.tsx` with `redirects()` in `apps/web/next.config.ts`. Detail routes stay, since plugin skills link to `/resumes/{id}`.
6. **Small folders and misplaced files.**
   - Inline `features/documents/documents-tabs.tsx` into the documents layout, as networking does.
   - `features/profile/account-menu.tsx` → `components/layout/`.
   - `features/terminal/terminal-panel.tsx` → `features/agent-dock/`.
   - Leaderboard files out of `portfolio/` into `features/leaderboard/`.
   - `analytics/portfolio-rank-chip.tsx` → portfolio.
   - Generic charts → `ui/data/`: `TopBoardsList` → `RankedBarList`, `ApplicationsTimelineChart` → `TimelineChart`.
   - Delete the empty `(auth)/layout.tsx`.
7. **`lib/` and providers.**
   - `lib/seo/` holds `job-posting-fields`, `job-posting-ld` and `structured-data`.
   - `lib/terminal/` holds `terminal`, `websocket` and `agent-storage`.
   - `providers/notification-provider.tsx` → `toast-provider.tsx`.
8. **Pilot feature tidy.**
   - `useTaskList` gets its own file.
   - `AgentList` moves out of `stage-card.tsx`.
   - `isRunPending` and `hourLabel` → `pilot/run-status.ts`.
   - `workspace/dashboard/pilot-card.tsx` imports through the pilot barrel.
   - `POSTED_OPTIONS` → `jobs/job-filter-options.ts`.
   - Delete the single-constant `campaigns/constants.ts`.
   - Drop the duplicate `onOpenDetail` overlay in `campaign-row.tsx`.
9. **Pages that only read the URL.** Move the `useSearchParams` reads into the client leaf and drop the server wrappers (web.md): `reset-password`, `verify-email`, `confirm-email-change`, `settings/security`.

## Phase 8: Comments, rule violations, dead code

- **Comments.** Cut or shorten to one line of why: `ui/layout/section-anchor-nav.tsx:15-30`, `ui/form/tanstack/index.ts:14-21`, "Presentational and controlled" in 3 field files, `api/queries.ts:27-31`, `auth/auth-card.tsx:10-14`, `auth/logout-button.tsx:13-17` (also rename the file to `logout-menu-item.tsx`), `settings/sections/connect-card.tsx:16-20`, `oauth-client-card.tsx:24-28`, `workspace/overview-panel.tsx:12`, `applications-panel.tsx:19`, `campaign-row.tsx:22-25`, `jobs-table.tsx:26-33`. Fix the stale ones (`profile-checklist-card.tsx:22`).
- **Rule violations.** Fix the remaining nested ternaries, `cond ? <X/> : null`, inline object types in signatures, missing return types, unbraced `if`s, manual `fontSize`/`fontWeight`, raw `<span>`, and `zIndex: 1201` in `app/loading.tsx`, which should use `theme.zIndex`.
- **Dead code.**
  - `NetworkingMessagesTable.emptyMessage`
  - The `if (!id) notFound()` guards
  - `String(id)` on strings
  - The unused `"warning"` in the Upwork color union
  - The debounce in `boards-content.tsx:157`
  - `LoadingSpinner.size`
  - `FileUpload` props used once (`buttonProps`, `description`)
  - The `DOCK_*` constants moving next to `agent-dock.tsx`
- **Copy.** Em dashes in `pilot/instructions/searches-list.tsx` become " - ". Share the password helper text across its 3 copies.
- Run `bun run knip` and remove anything it flags.

---

## Verification

- **Each phase:** the `verify` skill (Biome CI, knip, API + web typechecks, API and contracts tests). Phases 4 and 7 change the API, so its tests must pass.
- **Manual run:** `bun run dev` (check `docker ps` / port 5433 first). Playwright MCP failed to connect this session; fix it to drive these checks, or click through by hand.
  - Phase 0:
    - Dashboard tiles stay correct with more campaigns than one page holds.
    - A running-only account doesn't show "No campaigns yet".
    - Typing "React, Next" keeps both keywords.
    - A wrong password on reset shows a single error.
  - Phase 1:
    - External links open in a new tab and internal ones don't.
    - Submit buttons show a spinner and keep their width.
    - Visual pass over the tables, menus and tabs after the font-size change.
  - Phase 3:
    - Network tab shows one campaign fetch on `/campaigns/[id]`, and the title updates live.
    - Editing a draft on `/networking/messages` refreshes the list without `router.refresh`.
    - Admin search and paging work.
    - A failed request (stop the API) shows the error row with Retry, not empty or not-found.
  - Phase 4:
    - `/documents/resumes` holds one EventSource.
    - An agent-created variant appears live.
    - One `/healthz` poll per 5s with the dock and the pilot overview both open.
    - SSE reconnect after an API restart catches up.
  - Phase 5: filters survive a refresh and a shared link on each converted list.
  - Phase 7:
    - `/account/security?oauth=linked` redirects with its query.
    - The OAuth link flow lands on `/settings/security`.
    - Public pages still render signed out, with no 307 to `/login`.
    - The `/resumes` and `/networking` redirects still work.
- **Deploy:** batch 1 is Phases 0–3 (web, plus the Phase 0 `campaigns/summary` API route). Batch 2 is Phases 4–8, with API and web deployed together for the contracts and redirect changes.

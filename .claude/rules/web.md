---
paths:
  - "apps/web/**"
---

# Web conventions (`apps/web`)

Commands (`bun --cwd=apps/web run …`): `typecheck` (`tsc --noEmit`), `typegen` (Next route/type
generation). `next build` type-checks too, so both gate a change.

## Files & components

- Kebab-case filenames (`auth-card.tsx`); named exports (default only for `page.tsx`/`layout.tsx`).
- RSC by default: never `"use client"` in pages or layouts - extract interactivity into
  `src/components/features/`.
- Props: `interface <Name>Props` (not `type`); destructure in the body, not in parameters.
- Conditional render: `cond && <X />`, not `cond ? <X /> : null`. A component that can render
  nothing returns `ReactNode` and early-returns `null` (never `ReactElement` + `return <></>`);
  one that always renders keeps `ReactElement`.
- React 19: `use()` for async data in client components. Never `useCallback`/`useMemo`/`memo` -
  the compiler handles it. Pass `ref` as a regular prop; no `forwardRef`.
- Never key lists by array index. Key by the model's `id` (resume rows all carry one -
  `backfillResumeIds` assigns it server-side); for a controlled list whose model has no id, use
  `useKeyedList` (`@/hooks/use-keyed-list`).
- `@/` maps to `src/`. Zod from `zod/v4`. Forms are TanStack Form + Zod validators.

## Routing / auth

`src/proxy.ts` (Next 16 middleware) gates routes by auth and role. **A new public route must be
added to its `config.matcher` exclusions (and `app/public-routes.ts`) or it 307-redirects to
`/login`** - the build still succeeds, so the bug only shows at runtime. Dot-paths
(`robots.txt`) are already excluded by `.*\..*`.

Cross-origin auth works because web and API are same-site: the httpOnly cookie rides
`credentials: "include"` + CORS (`CORS_ORIGINS`). SSE/`EventSource` also connects straight to
the API (base URL from `src/api/base-url.ts`).

## MUI

- Barrel imports only (`import { Button } from "@mui/material"`), never deep imports.
- Theme values only: semantic colors (`"primary.main"`, `"background.paper"`,
  `"text.secondary"`, `"divider"` - they carry dark mode), numeric spacing (`p: 2` = 16px),
  typography variants (`variant="h4"`) - never hex values, pixel strings, or manual
  `fontSize`/`fontWeight`.
- `sx` for one-off styling; extract a component when repeated. No inline `style={{ }}`, no
  `styled-components`/`styled()`, no raw `<div>`/`<span>` for layout - use `Box`, `Stack`,
  `Typography`.
- `Stack` rejects layout props like `flexWrap`/`alignItems` - put them in `sx`.

## Pagination

Never hand-roll a pager. Filter a short bare-array list (boards, resumes, credentials) in the
browser; filter a paginated one server-side, since it only ever sees the page it was handed.

- `usePaginationParams()` owns the page state (URL-backed). Spread its `query` into the
  `*Queries.list(...)` factory; read rows from `data.items`. `prefix` namespaces a second pager
  on one route; `navigate: true` for an RSC page, whose fetch needs a real navigation.
- Controls: `<PaginationFooter pagination={data.pagination} …>`, or
  `{...gridPagination(pagination, data?.pagination)}` on a `<DataTable>`, or
  `<PaginationControls>` from an RSC page. Page sizes come from `PAGE_SIZE_OPTIONS`.
- A filter change resets the page - the old offset means nothing under a new filter. Write
  URL-backed filters through `setFilters({ … })`, which resets in the same URL update; a filter
  setter plus a separate `setPage(1)` would start from the same snapshot and undo itself.
- `/jobs` is the one exception: `JobPager` renders real `<a href>` paging for crawlers.

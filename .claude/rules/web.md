---
paths:
  - "apps/web/**"
---

# Web conventions (`apps/web`)

Commands (`bun --cwd=apps/web run <name>`): `typecheck` (`tsc --noEmit`, the fast local gate),
`typegen`. `next build` runs the same type check.

## Files and components

- Kebab-case filenames. Named exports, except `page.tsx` and `layout.tsx`.
- Pages and layouts are server components. Never `"use client"` in one. Interactive parts go in
  `src/components/features/`.
- Props: `interface <Name>Props`, destructured in the body.
- Conditional render: `cond && <X />`, not `cond ? <X /> : null`.
- A component that can render nothing returns `ReactNode` and `return null`. One that always
  renders returns `ReactElement`.
- React 19: `use()` for async data in client components. No `useCallback` / `useMemo` / `memo`.
  `ref` is a normal prop, no `forwardRef`.
- Key lists by model `id`, never by index. For a controlled list without ids, use `useKeyedList`
  from `@/hooks/use-keyed-list`.
- `@/` maps to `src/`. Zod from `zod/v4`. Forms are TanStack Form + Zod.

## Streaming pages

When a page depends on `params`, `searchParams`, or a fetch:

1. Keep the default export synchronous. It renders only the frame.
2. Put each dynamic dependency in its own `async` child inside `<Suspense>`. Data that arrives
   together shares one boundary.
3. Use a shared skeleton: `DetailSkeleton` / `TableSkeleton` from `@/components/ui/data`, or
   `AuthFormSkeleton` from `@/components/features/auth`. Add to that set, no page-local ones.

A client leaf that only reads the URL calls `useSearchParams()` itself. No server wrapper.

## Routing and auth

`src/proxy.ts` gates routes by auth and role. A new public route goes in two places: the
`config.matcher` exclusions and `app/public-routes.ts`. Miss one and it 307-redirects to
`/login` at runtime. The auth cookie rides `credentials: "include"` + CORS (`CORS_ORIGINS`). SSE
connects straight to the API via `src/api/base-url.ts`.

## MUI

- Barrel imports only: `import { Button } from "@mui/material"`.
- Theme values only: semantic colors (`"primary.main"`, `"text.secondary"`), numeric spacing
  (`p: 2`), typography variants. No hex, pixel strings, or manual `fontSize` / `fontWeight`.
- `sx` for one-offs. Extract a component when it repeats.
- No `style={{ }}`, no `styled()`, no raw `<div>` / `<span>` for layout. Use `Box`, `Stack`,
  `Typography`.
- `Stack` rejects `flexWrap` / `alignItems` props. Put them in `sx`.

## Pagination

Never hand-roll a pager. Filter short bare-array lists in the browser. Filter paginated lists
server-side.

- `usePaginationParams()` owns URL-backed page state. Spread its `query` into
  `*Queries.list(...)`. Rows are in `data.items`. `prefix` for a second pager on one route.
  `navigate: true` on an RSC page.
- Controls: `<PaginationFooter pagination={data.pagination}>`, or `gridPagination(...)` on a
  `<DataTable>`, or `<PaginationControls>` from an RSC page. Sizes from `PAGE_SIZE_OPTIONS`.
- A filter change resets the page. Use `setFilters({ … })`, which resets in the same URL update.
  A separate `setPage(1)` reads the old snapshot and undoes itself.
- `/jobs` is the exception: `JobPager` renders real `<a href>` links for crawlers.

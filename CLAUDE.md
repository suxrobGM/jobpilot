# JobPilot

Local AI job-application app. Uses Claude Code or Codex as the provider, a Next.js + SQLite web app at `http://localhost:8000` for state, and a .NET PTY host at `:8001` for the embedded terminal.

## Layout

- `plugin/` — the JobPilot plugin, loaded by Claude (`--plugin-dir plugin`) and Codex (via `.agents/plugins/marketplace.json` → `./plugin`). One tree serves both providers — no generation step.
  - `plugin/.claude-plugin/plugin.json` & `plugin/.codex-plugin/plugin.json` — provider manifests (both name the plugin `jobpilot`).
  - `plugin/.mcp.json` — Playwright MCP wiring, shared by both providers.
  - `plugin/skills/<name>/SKILL.md` — one hand-authored, provider-neutral skill per directory; `plugin/skills/shared/*.md` — shared docs. **Edit here directly.**
- `src/web/` — Bun + Next.js 16 + MUI 9 + Prisma 7 + TanStack Query/Form + Zod v4. Owns all persistence (SQLite at `prisma/app.db`, resumes at `storage/resumes/`).
- `src/terminal/` — .NET 10 minimal API hosting one provider PTY (project `JobPilot.Terminal`). Exposes `/ws`, `/sessions/start`, `/sessions/inject`, `/sessions/current`, `/healthz`.

## Commands

Root (`bun run …`):

- `dev` — runs terminal (`:8001`) + web (`:8000`) together.
- `db:setup` — generate Prisma client, apply migrations, seed default boards.
- `build:web` / `build:terminal` — production builds.

Web (`bun --cwd=src/web run …`):

- `lint`, `typecheck`, `format` — Next lint, `tsc --noEmit`, Prettier.
- `typegen` — Next route/type generation.
- `db:generate`, `db:migrate` (create-only), `db:migrate:apply`, `db:seed`, `db:reset`, `db:studio`.

## Skill conventions

- One tree, both providers. Skills are provider-neutral: reference sibling skills by name (e.g. "invoke the `tailor-resume` skill"), not provider-specific command tokens, and reference shared docs by repo-relative path (`plugin/skills/shared/<doc>.md`). Claude extras like `allowed-tools` are fine in frontmatter — Codex ignores unknown keys.
- Imperative voice, addressed to the provider.
- Start by checking `GET /api/health`; abort with a clear message if the web app is down.
- Talk to the web app via `curl -fsS "$JOBPILOT_API/api/..."` (`JOBPILOT_API=http://localhost:8000`). No direct DB access.
- Load profile/resume/credentials via `plugin/skills/shared/setup.md`.
- Credential lookup: board override → `Credential.scope === <domain>` → `Credential.scope === "default"`.
- Log in proactively before searching/applying.
- Dedupe applied jobs via `GET /api/applied/check` (exact URL + fuzzy title+company, 30-day window).
- During runs, `PATCH /api/runs/[id]/jobs/[jobKey]` for non-terminal status transitions (pending → approved → applying). On terminal outcome (applied / failed / skipped), `POST /api/runs/[id]/jobs/[jobKey]/result` — one call updates RunJob, creates the Application row (when applied), marks the queue entry, and recomputes the run summary.
- Browser automation: use `browser_snapshot` (with `ref` for large pages), not screenshots.

## Frontend conventions (`src/web/src/`)

- **Files**: kebab-case (`auth-card.tsx`, `use-auth.ts`). No PascalCase filenames.
- **Exports**: named for components/hooks/providers. Default exports only for `page.tsx` / `layout.tsx`.
- **RSC by default**: never put `"use client"` in pages or layouts — extract interactivity into `src/components/features/`.
- **Props**: `interface <Name>Props` (not `type`). Destructure inside the body, not in parameters.
- **Conditional render**: `cond && <X />` rather than `cond ? <X /> : null`.
- **MUI**: barrel imports (`import { Button } from "@mui/material"`), never deep imports.
- **Aliases**: `@/` maps to `src/` (e.g. `@/hooks/use-auth`).
- **Zod**: import from `zod/v4`.
- **Forms**: TanStack Form + Zod validators.
- **React 19**: use the `use()` hook for async data in client components. Never use `useCallback`, `useMemo`, or `memo` — the compiler handles it. Pass `ref` as a regular prop; do **not** use `forwardRef`.

## Styling Guidelines (MUI)

## Key Rules

- **Theme colors only** — never hardcode hex values. Use `"primary.main"`, `"background.paper"`, `"text.secondary"`, etc.
- **Theme spacing** — use numeric units (`p: 2` = 16px), not pixel strings
- **Typography variants** — use `variant="h4"`, not manual `fontSize`/`fontWeight`
- **`sx` prop** for one-off styling. If repeated, extract a component
- **Semantic colors** for dark mode support: `"background.paper"`, `"text.primary"`, `"divider"`

## Forbidden Patterns

- No inline `style={{ }}` — use MUI `sx` prop instead
- No `styled-components` or MUI's `styled()` — use `sx` or extract a component
- No raw `<div>` / `<span>` for layout — use `Box`, `Stack`, `Typography`

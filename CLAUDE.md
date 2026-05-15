# JobPilot - Multi-Provider Job Application Agent

## What This Is

JobPilot 2.0 is a local AI job-application app with Claude Code and Codex
provider support, paired with a local Next.js + SQLite web app at
`http://localhost:8000` that owns all persistent state. Reusable workflow
instructions live in `src/jobpilot-skills/`; provider plugins live in
`src/jobpilot-claude-plugin/` and `src/jobpilot-codex-plugin/`. A companion
.NET process, **JobPilot.Terminal** at `src/JobPilot.Terminal/` (port 8001),
hosts one active provider PTY so the web UI can embed an interactive terminal
and inject provider-specific commands.

## Architecture

- **Shared JobPilot skills** in `src/jobpilot-skills/` own provider-neutral
  workflows (`skills/*.md`) and shared instructions (`shared/*.md`).
- **Claude Code plugin** in `src/jobpilot-claude-plugin/` owns
  `.claude-plugin/plugin.json`, `.mcp.json`, and thin `skills/<name>/SKILL.md`
  wrappers. Its namespace is `jobpilot`, so skills run as `/jobpilot:<skill>`.
- **Codex plugin** in `src/jobpilot-codex-plugin/` owns
  `.codex-plugin/plugin.json`, `.mcp.json`, and thin
  `skills/jobpilot-<name>/SKILL.md` wrappers. Skills run as
  `$jobpilot-<skill>`.
- **Web app** in `src/web/` is the data + UI layer: Bun + Next.js 16 + MUI 9
  + Prisma 7 + TanStack Query/Form + Zod v4. Dark-only F2 theme, Geist
  fonts, kanban Pipeline at `/` with virtualized columns + URL-driven filter
  bar, and a resizable right-side agent dock (Pilot / Terminal / Events
  tabs). SQLite database at `src/web/prisma/dev.db`; uploaded resumes at
  `src/web/storage/resumes/`.
- **JobPilot.Terminal** in `src/JobPilot.Terminal/` is a .NET 10 ASP.NET Core
  minimal API. It owns one active provider PTY, starts Claude with
  `--plugin-dir src/jobpilot-claude-plugin` or Codex with
  `codex --no-alt-screen -C <repo>`, and exposes `/ws`, `/sessions/start`,
  `/sessions/inject`, `/sessions/current`, and `/healthz`.
- **Skills talk to the web app over HTTP.** They do not own persistence.
  Every skill calls `GET /api/health` first; if the app is down it stops with
  a clear message.
- **Humanizer** lives in `src/jobpilot-skills/skills/humanizer.md`, invoked by
  `cover-letter` and `upwork-proposal` through provider-specific wrappers.

## Key Patterns

- Provider wrappers reference shared files by setting `JOBPILOT_SKILLS_ROOT`
  and then reading `${JOBPILOT_SKILLS_ROOT}/skills/<skill>.md`.
- `src/jobpilot-skills/shared/setup.md` is the single source of truth for loading profile,
  resume, and credentials.
- Skills set `JOBPILOT_API=http://localhost:8000` and issue
  `curl -fsS "$JOBPILOT_API/api/..."` calls. Mutations go through `POST`,
  `PATCH`, or `DELETE` against the same API.
- Credential lookup order: board-specific (`JobBoard.email`/`.password`
  override), then scope-matched (`Credential.scope === <domain>`), then
  `Credential.scope === "default"`.
- Job boards are rows in the `JobBoard` table with `type: "search"` or
  `type: "ats"`. Users add boards through `/boards`; skills iterate over
  whatever `/api/job-boards` returns.
- Skills proactively log in before searching/applying.
- Previously applied jobs are matched by exact URL and fuzzy normalized
  title+company over a 30-day window via `GET /api/applied/check`.
- After every successful application, skills `POST /api/applied`. After every
  state change in an autopilot/apply run, they
  `PATCH /api/runs/[id]/jobs/[jobKey]` and `PATCH /api/runs/[id]` so the live
  viewer reflects reality.

## Conventions

- Skill files use imperative instructions directed at Claude.
- Browser automation uses `browser_snapshot` (accessibility tree), not
  screenshots.
- For token overflow from large pages, use targeted `browser_snapshot` with
  the `ref` parameter.
- Cover letters chain through the provider's cover-letter command, which
  invokes the provider's humanizer command.
- Claude plugin manifest is in
  `src/jobpilot-claude-plugin/.claude-plugin/plugin.json` (currently `2.0.0`).
- Codex plugin manifest is in
  `src/jobpilot-codex-plugin/.codex-plugin/plugin.json` (currently `2.0.0`).
- MCP config is duplicated at each provider plugin's `.mcp.json`.
- Project permissions are in root `.claude/settings.json`.

## File Inventory

| Path                                                                        | Purpose                                                                 |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/jobpilot-skills/shared/*.md`                                           | Shared instructions (setup, auth, form-filling, browser-tips).          |
| `src/jobpilot-skills/skills/*.md`                                           | Provider-neutral JobPilot workflow prompts.                             |
| `src/jobpilot-claude-plugin/.claude-plugin/plugin.json`                     | Claude plugin manifest (name, version, author).                         |
| `src/jobpilot-claude-plugin/.mcp.json`                                      | Claude Playwright MCP server config.                                    |
| `src/jobpilot-claude-plugin/skills/*/SKILL.md`                              | Claude provider wrappers.                                               |
| `src/jobpilot-codex-plugin/.codex-plugin/plugin.json`                       | Codex plugin manifest.                                                  |
| `src/jobpilot-codex-plugin/.mcp.json`                                       | Codex Playwright MCP server config.                                     |
| `src/jobpilot-codex-plugin/skills/*/SKILL.md`                               | Codex provider wrappers.                                                |
| `.claude/settings.json`                                                     | Claude Code project permissions.                                        |
| `CLAUDE.md`                                                                 | This file: architecture summary + frontend conventions.                 |
| `AGENTS.md`                                                                 | Thin pointer back to `CLAUDE.md` for agent sessions.                    |
| `README.md`                                                                 | User-facing intro + quick start.                                        |
| `docs/architecture.md`                                                      | Deeper architecture walk-through.                                       |
| `docs/self-hosting.md`                                                      | Operations + configuration runbook.                                     |
| `JobPilot.slnx`                                                             | Solution file referencing the C# terminal project.                      |
| `package.json`                                                              | Root scripts (`bun run dev` runs terminal + web together).              |
| `src/JobPilot.Terminal/`                                                    | .NET terminal: provider launch, Program.cs, SessionManager, PTY code.   |
| `src/web/prisma/schema/*.prisma`                                            | Multi-file Prisma schema (one file per domain).                         |
| `src/web/prisma/dev.db`                                                     | SQLite database (gitignored).                                           |
| `src/web/storage/resumes/*.pdf`                                             | Uploaded resumes (gitignored).                                          |
| `src/web/src/app/api/**/route.ts`                                           | API endpoints.                                                          |
| `src/web/src/app/**/page.tsx`                                               | Pages (RSC).                                                            |
| `src/web/src/components/features/<domain>/`                                 | Domain-specific React components.                                       |
| `src/web/src/components/features/pipeline/`                                 | Kanban home page: board, virtualized columns, filter bar, card.         |
| `src/web/src/components/features/agent-dock/`                               | Right-side Pilot dock: strip, panel, tabs, resize handle, chat input.   |
| `src/web/src/components/features/settings/`                                 | Scroll-and-anchor settings page sections (personal, address, …).        |
| `src/web/src/components/features/terminal/`                                 | xterm.js terminal panel + WS client (embedded in dock terminal tab).    |
| `src/web/src/components/ui/{data,display,feedback,form,layout}/`            | UI primitives.                                                          |
| `src/web/src/components/ui/layout/section-anchor-nav.tsx`                   | Sticky left rail that highlights the currently-visible section.         |
| `src/web/src/providers/agent-provider.tsx`                                  | Dock open/tab/width state + `inject(command)` helper.                   |
| `src/web/src/hooks/use-search-param.ts`                                     | URL-state binding for filter bars (`useSearchParam{,Number}`).          |
| `src/web/src/hooks/use-debounced-value.ts`                                  | Generic debounced-value hook (used by pipeline search).                 |
| `src/web/src/lib/db.ts`                                                     | Prisma client singleton (libSQL adapter).                               |
| `src/web/src/lib/terminal.ts`                                               | Terminal HTTP client (`startSession`, `injectCommand`, `killSession`).  |
| `src/web/src/lib/api/api-server.ts`                                         | Server-side `apiGet<T>(path)` for RSC → own-API fetches.                |
| `src/web/src/lib/sse.ts`                                                    | In-process SSE broker.                                                  |
| `src/web/src/lib/matching.ts`                                               | Jaro-Winkler fuzzy duplicate detection.                                 |
| `src/web/src/lib/schemas/*.ts`                                              | Zod schemas (shared by API + form validators).                          |
| `src/web/src/lib/api/query-keys.ts`                                         | Structured TanStack Query keys.                                         |
| `src/web/src/app/api/pipeline/route.ts`                                     | Cursor-paginated pipeline column data (stage + filters).                |
| `src/web/src/types/api/*.ts`                                                | DTOs returned by API endpoints.                                         |

## Frontend Conventions

Apply to all code under `src/web/src/`.

### File Naming

- **Kebab-case** for all files: `app-shell.tsx`, `use-auth.ts`, `auth-card.tsx`
- No PascalCase filenames

### Exports

- **Named exports** for all components, hooks, providers: `export function Sidebar()`
- **Default exports** only for Next.js pages and layouts (`page.tsx`, `layout.tsx`)

### Server Components by Default

- **Never** add `"use client"` to `page.tsx` or `layout.tsx` files. Pages and layouts must be React Server Components.
- Extract interactive logic (hooks, state, event handlers) into `"use client"` feature components under `src/components/features/`.

### Component Props

Use `interface` (not `type`) for prop shapes. `type` is fine for unions, utilities, and domain values; `interface` is required for `<Name>Props`:

```typescript
// CORRECT
interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

// WRONG
type SidebarProps = { open: boolean; onToggle: () => void };
```

Destructure props inside the function body, not in parameters:

```typescript
// CORRECT
function Sidebar(props: SidebarProps): ReactElement {
  const { open, onToggle } = props;
}

// WRONG
function Sidebar({ open, onToggle }: SidebarProps): ReactElement {}
```

### Conditional Rendering

Prefer `&&` over a ternary when the false branch is `null`:

```tsx
// CORRECT
{
  description && <Typography variant="body2Muted">{description}</Typography>;
}

// WRONG
{
  description ? <Typography variant="body2Muted">{description}</Typography> : null;
}
```

### MUI Imports

Use consolidated barrel imports, never deep imports:

```typescript
// CORRECT
import { Alert, Button, TextField } from "@mui/material";
// WRONG
import Alert from "@mui/material/Alert";
```

### Path Aliases

`tsconfig.json` uses `"@/*": ["./src/*"]`. Imports use `@/` without `src/`:

```typescript
import { useAuth } from "@/hooks/use-auth";
import { client } from "@/lib/api/client";
```

### Zod v4

Import from `zod/v4`:

```typescript
import { z } from "zod/v4";
```

### Forms

Use TanStack Form with Zod validators:

```typescript
const form = useForm({
  defaultValues: { email: "", password: "" },
  validators: { onSubmit: loginSchema },
  onSubmit: async ({ value }) => { ... },
});
```

### React 19

- Use `use()` hook for async data in client components instead of `useEffect` + `useState`. Avoids React compiler `set-state-in-effect` warnings.
- **Never** use `useCallback`, `useMemo`, or `memo`; the React 19 compiler handles memoization automatically.

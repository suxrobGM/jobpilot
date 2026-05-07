# JobPilot - Claude Code Plugin

## What This Is

JobPilot 2.0 is a Claude Code plugin for AI-driven job applications, paired
with a local Next.js + SQLite web app at `http://127.0.0.1:8000` that owns
all of the persistent state. Skills are markdown prompts (`skills/*/SKILL.md`);
the web app is real TypeScript code under `web/`.

## Architecture

- **Skills** live in `skills/<name>/SKILL.md` as markdown with YAML frontmatter. They drive Playwright via the MCP server, parse pages, score against the resume, fill forms.
- **Shared instructions** in `skills/_shared/` (setup, auth, form-filling, browser-tips) are referenced by skills to avoid duplication.
- **Web app** in `web/` is the data + UI layer: Bun + Next.js 16 + MUI 9 + Prisma 7 + TanStack Query/Form + Zod v4. SQLite database at `web/prisma/dev.db`; uploaded resumes at `web/storage/resumes/`.
- **Skills talk to the web app over HTTP.** They do not read or write any local JSON or text files. Every skill calls `GET /api/health` first; if the app is down it stops with a clear message.
- **Humanizer** is an external git submodule at `skills/humanizer/`, invoked by `cover-letter` and `upwork-proposal` skills.

## Key Patterns

- Skills reference shared files with: `Read and follow the instructions in ${CLAUDE_PLUGIN_ROOT}/skills/_shared/<file>.md`. `_shared/setup.md` is the single source of truth for "load the profile, resume, and credentials".
- Skills set `JOBPILOT_API=http://127.0.0.1:8000` at the top and then issue `curl -fsS "$JOBPILOT_API/api/..."` calls. Mutations go through `POST` / `PATCH` / `DELETE` against the same API.
- Credential lookup order: board-specific (`JobBoard.email`/`.password` override) → scope-matched (`Credential.scope === <domain>`) → `Credential.scope === "default"`.
- Job boards are rows in the `JobBoard` table with `type: "search"` or `type: "ats"`. Users add boards through the web UI at `/boards`; skills iterate over whatever `/api/job-boards` returns.
- Skills proactively log in before searching/applying, not just reactively when redirected.
- Previously applied jobs are matched both by exact URL and by fuzzy normalized title+company over a 30-day window via `GET /api/applied/check`.
- After every successful application, skills `POST /api/applied`. After every state change in an autopilot/apply-batch run, they `PATCH /api/runs/[id]/jobs/[jobKey]` and `PATCH /api/runs/[id]` so the SSE-driven live viewer reflects reality.

## Conventions

- Skill files use imperative instructions directed at Claude (e.g., "Use `browser_navigate` to open the URL").
- Browser automation uses `browser_snapshot` (accessibility tree), not screenshots.
- For token overflow from large pages, use targeted `browser_snapshot` with the `ref` parameter.
- Cover letters chain through `/jobpilot:cover-letter`, which already invokes the humanizer.
- Plugin manifest is in `.claude-plugin/plugin.json` (currently `2.0.0`).
- MCP config (Playwright server) is in `.mcp.json`.
- API permissions in `.claude/settings.json` allow `Bash(curl:*)`, `Bash(jq:*)`, `Bash(date:*)` explicitly.

## File Inventory

| Path | Purpose |
| --- | --- |
| `.claude-plugin/plugin.json` | Plugin manifest (name, version, author). |
| `.claude/settings.json` | Claude Code permissions. |
| `.mcp.json` | Playwright MCP server config. |
| `CLAUDE.md` | This file: architecture summary + frontend conventions. |
| `README.md` | User-facing intro + quick start. |
| `docs/architecture.md` | Deeper architecture walk-through. |
| `docs/self-hosting.md` | Operations + configuration runbook. |
| `skills/_shared/*.md` | Shared instructions (setup, auth, form-filling, browser-tips). |
| `skills/*/SKILL.md` | Individual skill prompts. |
| `skills/humanizer/` | Cover-letter humanizer (git submodule). |
| `web/prisma/schema/*.prisma` | Multi-file Prisma schema (one file per domain). |
| `web/prisma/dev.db` | SQLite database (gitignored). |
| `web/storage/resumes/*.pdf` | Uploaded resumes (gitignored). |
| `web/src/app/api/**/route.ts` | API endpoints. |
| `web/src/app/**/page.tsx` | Pages (RSC). |
| `web/src/components/features/<domain>/` | Domain-specific React components. |
| `web/src/components/ui/{data,display,feedback,form,layout}/` | UI primitives. |
| `web/src/lib/db.ts` | Prisma client singleton (libSQL adapter). |
| `web/src/lib/sse.ts` | In-process SSE broker. |
| `web/src/lib/matching.ts` | Jaro-Winkler fuzzy duplicate detection. |
| `web/src/lib/schemas/*.ts` | Zod schemas (shared by API + form validators). |
| `web/src/lib/api/query-keys.ts` | Structured TanStack Query keys. |
| `web/src/types/api/*.ts` | DTOs returned by API endpoints. |

## Frontend Conventions

Apply to all code under `web/src/`.

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
{description && <Typography variant="body2Muted">{description}</Typography>}

// WRONG
{description ? <Typography variant="body2Muted">{description}</Typography> : null}
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
- **Never** use `useCallback`, `useMemo`, or `memo` — the React 19 compiler handles memoization automatically.

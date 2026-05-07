# JobPilot - Claude Code Plugin

## What This Is

A Claude Code plugin for automated job searching and applications. All logic is prompt-based (SKILL.md files) -- no compiled code. Skills instruct Claude what to do at runtime using Playwright MCP for browser automation.

## Architecture

- **Skills** live in `skills/<name>/SKILL.md` as markdown with YAML frontmatter
- **Shared instructions** in `skills/_shared/` (setup, auth, form filling, browser tips) are referenced by skills to avoid duplication
- **Profile system** in `profile.json` stores personal info, credentials, job board config, and autopilot settings. Gitignored for security. `profile.example.json` is the template.
- **Autopilot progress** tracked in `runs/<run-id>.json` files (gitignored). Each run logs every job's status transitions.
- **Applied-jobs database** in `applied-jobs.json` (gitignored) is a persistent record of all applied jobs across runs and skills. Prevents duplicate applications even if run files are deleted.
- **Scripts** in `scripts/` for utility tasks. All scripts use `jq` only (no Python/Node fallbacks) to avoid permission prompts.
- **Humanizer** is an external git submodule at `skills/humanizer/`

## Key Patterns

- Skills reference shared files with: `Read and follow the instructions in ${CLAUDE_PLUGIN_ROOT}/skills/_shared/<file>.md`
- Credential lookup order: board-specific (`jobBoards[].email/password`) -> domain-specific (`credentials.<domain>`) -> `credentials.default`
- Job boards are a dynamic array in `profile.json` with `type: "search"` or `type: "ats"`. Users add boards without code changes.
- Skills proactively log in before searching/applying, not just reactively when redirected
- Previously applied jobs are tracked in `applied-jobs.json` and checked via `scripts/check-applied.sh` before every application
- After every successful application, log it via `scripts/log-applied.sh`

## Conventions

- Skill files use imperative instructions directed at Claude (e.g., "Use `browser_navigate` to open the URL")
- No inline Python/Node scripts for parsing -- use `Read` and `Grep` tools instead to avoid permission prompts
- Browser automation uses `browser_snapshot` (accessibility tree) not screenshots
- For token overflow from large pages, use targeted `browser_snapshot` with `ref` parameter
- Cover letters chain through `/jobpilot:cover-letter` which already invokes the humanizer
- Plugin manifest is in `.claude-plugin/plugin.json`
- MCP config (Playwright server) is in `.mcp.json`

## File Inventory

| Path | Purpose |
| ---- | ------- |
| `.claude-plugin/plugin.json` | Plugin manifest (name, version, author) |
| `.mcp.json` | Playwright MCP server config |
| `profile.json` | User config with credentials (gitignored) |
| `profile.example.json` | Template for new users |
| `skills/_shared/*.md` | Shared instructions (setup, auth, form-filling, browser-tips) |
| `skills/*/SKILL.md` | Individual skill prompts |
| `scripts/check-applied.sh` | Checks if a job URL was already applied to |
| `scripts/log-applied.sh` | Logs a successful application to the database |
| `scripts/run-stats.sh` | Aggregates stats from all run files |
| `scripts/export-csv.sh` | Exports applications to CSV |
| `scripts/update-run.sh` | Updates run file fields without full JSON read |
| `applied-jobs.json` | Persistent applied-jobs database (gitignored) |
| `runs/*.json` | Autopilot progress files (gitignored) |
| `settings.json` | Plugin-level permission settings |

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

Destructure props inside the function body, not in parameters:

```typescript
// CORRECT
function Sidebar(props: SidebarProps): ReactElement {
  const { open, onToggle } = props;
}

// WRONG
function Sidebar({ open, onToggle }: SidebarProps): ReactElement {}
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

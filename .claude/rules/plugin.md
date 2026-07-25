---
paths:
  - "plugin/**"
---

# Plugin conventions (`plugin/`)

One provider-neutral tree serves Claude (`--plugin-dir plugin`; marketplace ships the
self-contained `skills/setup` bootstrap) and Codex (`jobpilot@sukhrob-codex-plugins`; its
marketplace gets `.codex-plugin`, `.mcp.json`, and the full `skills/` tree). The tree
also ships inside terminal archives - the host exposes it via `JOBPILOT_SKILLS_ROOT`. No
generation step - edit here directly.

- `.claude-plugin/plugin.json` & `.codex-plugin/plugin.json` - provider manifests (both name it
  `jobpilot`); `.mcp.json` - Playwright MCP wiring shared by both.
- `skills/<name>/SKILL.md` - one hand-authored skill per directory.
- `skills/_shared/*.md` - reference docs: `auth`, `browser-tips`, `campaign-flow`,
  `digest-schema`, `eligibility`, `form-filling`, `setup`, `untrusted-content`. The directory has
  no `SKILL.md`, so neither provider lists it as a skill - both discover skills by finding
  `SKILL.md`, and Codex ships the files with the plugin without surfacing them.
- `agents/*.md` - worker subagents (`job-worker` score/apply, `networking-worker`
  discover/compose) that campaign skills delegate per-iteration so heavy browser/snapshot work
  stays out of the main context. The `.md` body is the single source of truth; Codex
  `.codex/agents/*.toml` files (repo root and terminal publish root) point back at it. Runtimes
  without custom subagents run the procedures inline (`skills/_shared/setup.md` → "Worker
  subagents").

## Writing skills

- Provider-neutral: reference sibling skills by name ("invoke the `tailor-resume` skill"), never
  provider-specific command tokens; shared docs by relative path (`../_shared/<doc>.md`).
  Claude-only frontmatter (`allowed-tools`) is fine - Codex ignores unknown keys.
- Imperative voice, addressed to the provider. Keep prose terse.
- Start by checking `GET /api/health`; abort with a clear message if the API is down.
- API access: `curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/..."`.
  The terminal host injects `JOBPILOT_API` (backend base URL), `JOBPILOT_API_TOKEN` (per-user
  PAT), and `JOBPILOT_WEB` (web origin, for user-facing links). Never hard-code `localhost`.
  No direct DB access.
- Load profile/resume/credentials via `skills/_shared/setup.md`. Credential lookup: board override →
  `Credential.scope === <domain>` → `scope === "default"`. Log in proactively before
  searching/applying.
- Dedupe applied jobs via `GET /api/applied/check` (exact URL + fuzzy title+company, 30-day
  window).
- Campaigns: `PATCH /api/campaigns/[id]/jobs/[jobKey]` for non-terminal transitions
  (pending → approved → applying). On terminal outcome (applied / failed / skipped),
  `POST /api/campaigns/[id]/jobs/[jobKey]/result` - one call updates the Job, creates the
  Application + initial event, and marks the queue entry. Summaries are derived from current
  rows, never persisted.
- Browser automation: `browser_snapshot` (with `ref` for large pages), not screenshots.

---
paths:
  - "plugin/**"
---

# Plugin conventions (`plugin/`)

One provider-neutral tree serves Claude (`--plugin-dir plugin`) and Codex (the host mirrors it into
`.agents/skills` and translates `.mcp.json` into launch overrides). Both marketplaces ship only the
self-contained `skills/setup` bootstrap; the full tree ships inside terminal archives and is exposed
through `JOBPILOT_SKILLS_ROOT`. No generation step - edit here directly.

- `.claude-plugin/plugin.json` & `.codex-plugin/plugin.json` - provider manifests (both name it
  `jobpilot`); `.mcp.json` - Playwright MCP wiring shared by both.
- `skills/<name>/SKILL.md` - one hand-authored skill per directory.
- Resume skills split by who writes what: `extract-resume` parses the PDF faithfully and chains
  `review-resume` on a first extraction; `review-resume` saves one `Suggested rewrite` variant to
  accept or discard, never touching a base; `tailor-resume` owns per-job variants and their
  restructuring, guarded in `apps/api/src/modules/resume/structure.ts`.
- `skills/pilot/kinds/<kind>.md` - one file per agenda kind. The host `/clear`s before every cycle
  injection, so anything in `pilot/SKILL.md` is re-read on every cycle: keep it to the loop
  (sense/claim/record/release/exit) and put per-kind procedure here, where only the claimed kind
  pays for it. Reference shared docs from these as `../../_shared/<doc>.md`.
- `skills/_shared/*.md` - reference docs: `auth`, `browser-tips`, `campaign-flow`,
  `digest-schema`, `eligibility`, `form-filling`, `setup`, `untrusted-content`. The directory has
  no `SKILL.md`, so neither provider lists it as a skill - both discover skills by finding
  `SKILL.md`, and the terminal mirrors these reference files beside Codex's runtime skills.
- `agents/*.md` - worker subagents (`job-worker` score/apply, `networking-worker`
  discover/compose) that campaign skills delegate per-iteration so heavy browser/snapshot work
  stays out of the main context. The `.md` body is the single source of truth; Codex
  `.codex/agents/*.toml` files (repo root and terminal publish root) point back at it. Runtimes
  without custom subagents run the procedures inline (`skills/_shared/setup.md` → "Worker
  subagents").

## Writing skills

- `skills/humanizer/` is vendored from [blader/humanizer](https://github.com/blader/humanizer) (MIT,
  its own `LICENSE`). To sync: `curl -fsSL https://raw.githubusercontent.com/blader/humanizer/main/SKILL.md`,
  diff against the pinned `metadata.version`, then re-apply the JobPilot additions - `allowed-tools`,
  the job-application paragraph and the two voice subsections under "Add personality only when it
  fits", the PTY note in the em-dash pattern, patterns 36-38, and the worked example. Upstream
  renumbers and retitles freely, so cite patterns by title, never by number, and re-read the
  frontmatter's `localPatterns` before assuming a range. Writing skills invoke it in **embedded mode** (final text
  only) - the default emits draft + audit + final, which is noise inside an apply flow.
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
  `POST /api/campaigns/[id]/jobs/[jobKey]/result` - one call updates the Job and creates the
  Application + initial event. Summaries are derived from current rows, never persisted.
- Browser automation: `browser_snapshot` (with `ref` for large pages), not screenshots.

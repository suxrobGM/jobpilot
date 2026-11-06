---
paths:
  - "plugin/**"
---

# Plugin conventions (`plugin/`)

One skill tree serves Claude (`--plugin-dir plugin`) and Codex (the host mirrors it into
`.agents/skills`). Marketplaces ship only `skills/setup`. The full tree ships inside terminal
archives as `JOBPILOT_SKILLS_ROOT`. No generation step. Edit here directly.

| Path | What it is |
| --- | --- |
| `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` | Provider manifests. |
| `.mcp.json` | Playwright MCP wiring for both providers. |
| `skills/<name>/SKILL.md` | One skill per directory. |
| `skills/_shared/*.md` | Reference docs. No `SKILL.md`, so not listed as a skill. Link as `../_shared/<doc>.md`. |
| `skills/pilot/tasks/<taskType>.md` | One file per task type. `pilot/SKILL.md` is re-read every cycle, so it holds only the loop. |
| `agents/*.md` | `job-scorer`, `job-applier`, `job-searcher`, `job-researcher` and `networking-worker` subagents, `model: inherit`. Source of truth: the host writes Codex's `.codex/agents/*.toml` from them, body inlined, at every Codex session start. The repo copies are checked in; a terminal test fails when they drift. |

Resume skills: `extract-resume` parses the PDF and chains `review-resume` on a first extraction.
`review-resume` saves one `Suggested rewrite` variant and never edits a base. `tailor-resume`
owns per-job variants, guarded in `apps/api/src/modules/resume/tailoring/structure.ts`.

## Writing a skill

- Provider-neutral. Name sibling skills ("invoke the `tailor-resume` skill"), never provider
  command tokens. Claude-only frontmatter (`allowed-tools`) is fine.
- Imperative voice, terse.
- Start with `GET /api/health`. Stop with a clear message if the API is down.
- Call the API with `jobpilot-api` (`plugin/bin/`, on the session's PATH), never curl or
  `Invoke-RestMethod`: Schannel fails TLS inside the Codex Windows sandbox, and the helper keeps
  the token out of commands. Never hard-code `localhost`. No direct DB access.

  ```sh
  jobpilot-api GET /api/...
  ```

  The host injects `JOBPILOT_API`, `JOBPILOT_API_TOKEN`, and `JOBPILOT_WEB` (for user-facing
  links).
- Load profile, resume, and credentials per `skills/_shared/setup.md`. Resolve a board login with
  `GET /api/credentials/resolve` (the board's login, else the default). Log in before searching.
- Dedupe with `GET /api/applications/duplicates` before applying.
- Jobs: `PATCH /api/feeds/[id]/jobs/[jobKey]` for non-terminal transitions.
  `POST .../jobs/[jobKey]/result` for applied / failed / skipped. It updates the job and creates
  the application in one call. Skills the user types write to their kind's feed
  (`POST /api/feeds {kind}` returns it).
- Browser: `browser_snapshot` (with `ref` on large pages), not screenshots.

## Humanizer

`skills/humanizer/` is adapted from [blader/humanizer](https://github.com/blader/humanizer) (MIT,
v3.1.0) and rewritten for job-search writing. It is not synced: port a useful upstream pattern by
hand, with a job-writing example. Writing skills invoke it in embedded mode (final text only) and
check repetition against the user's recent texts themselves, since the humanizer sees one text.

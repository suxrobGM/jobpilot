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
| `skills/pilot/kinds/<kind>.md` | One file per agenda kind. `pilot/SKILL.md` is re-read every cycle, so it holds only the loop. |
| `agents/*.md` | `job-worker` and `networking-worker` subagents. Source of truth. Codex `.codex/agents/*.toml` files point back at it. |

Resume skills: `extract-resume` parses the PDF and chains `review-resume` on a first extraction.
`review-resume` saves one `Suggested rewrite` variant and never edits a base. `tailor-resume`
owns per-job variants, guarded in `apps/api/src/modules/resume/structure.ts`.

## Writing a skill

- Provider-neutral. Name sibling skills ("invoke the `tailor-resume` skill"), never provider
  command tokens. Claude-only frontmatter (`allowed-tools`) is fine.
- Imperative voice, terse.
- Start with `GET /api/health`. Stop with a clear message if the API is down.
- Call the API with curl. Never hard-code `localhost`. No direct DB access.

  ```sh
  curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/..."
  ```

  The host injects `JOBPILOT_API`, `JOBPILOT_API_TOKEN`, and `JOBPILOT_WEB` (for user-facing
  links).
- Load profile, resume, and credentials per `skills/_shared/setup.md`. Credential order: board
  override, `scope === <domain>`, `scope === "default"`. Log in before searching.
- Dedupe with `GET /api/applied/check` before applying.
- Campaigns: `PATCH /api/campaigns/[id]/jobs/[jobKey]` for non-terminal transitions.
  `POST .../jobs/[jobKey]/result` for applied / failed / skipped. It updates the job and creates
  the application in one call.
- Browser: `browser_snapshot` (with `ref` on large pages), not screenshots.

## Vendored humanizer

`skills/humanizer/` is from [blader/humanizer](https://github.com/blader/humanizer) (MIT). To
sync: fetch upstream `SKILL.md`, diff against `metadata.version`, re-apply the JobPilot additions
(`allowed-tools`, job-application paragraph, voice subsections, PTY note, `metadata.localPatterns`,
worked example). Cite patterns by title, never number. Writing skills invoke it in embedded mode
(final text only).

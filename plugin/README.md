# JobPilot plugin

The plugin that turns Claude Code or Codex into your job-search agent. One
provider-neutral skill tree serves both: `search`, `auto-apply`, `apply`,
`networking`, `cover-letter`, and the rest of the commands listed in the
[root README](../README.md#skills).

The agent runs on your own machine and your own Claude/Codex subscription. It
drives a real browser, reads your profile and resumes from the
[JobPilot dashboard](https://jobpilot.suxrobgm.net), and writes results back so
your pipeline updates live.

## Install

The marketplace commands for Claude Code and Codex live in the
[root README](../README.md#install-the-plugin).

Both providers finish by running the `setup` skill, which installs the local
terminal companion, starts the agent, and opens the dashboard. After that you
can launch and control the agent from the dashboard's agent dock.

Provider marketplaces carry only that bootstrap skill. The terminal release
bundles the full tree and exposes it to dashboard sessions for both providers.

## Layout

- `skills/<name>/SKILL.md`: one workflow per directory, referenced by name so
  the same text serves both providers.
- `skills/_shared/*.md`: reference docs several skills pull in, by relative
  path (`../_shared/setup.md`). No `SKILL.md`, so neither provider lists the
  directory as a skill.
- `agents/*.md`: worker subagents that campaign skills delegate per-job work
  to, keeping heavy browser output out of the main session.
- `.mcp.json`: the Playwright MCP server the skills use to drive the browser.

Edit skills here directly; there is no generation step. See the
[development guide](../docs/development.md) for how the plugin is loaded and
published.

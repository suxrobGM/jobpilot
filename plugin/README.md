# JobPilot plugin

Turns Claude Code or Codex into a job-search agent. It searches job boards, tailors your resume
per posting, fills applications, writes cover letters and recruiter messages, and keeps your
[JobPilot dashboard](https://jobpilot.suxrobgm.net) current. It runs on your computer with your
own Claude or Codex subscription; your data lives in your JobPilot account.

## Install

Install the plugin from your provider's marketplace (commands in the
[main README](../README.md#get-started)), then run `setup`. It installs and starts the terminal
host and opens the dashboard, where you launch and watch the agent.

The marketplace ships only `setup`. The terminal host carries the full skill set and keeps it
updated. The [skills guide](https://jobpilot.suxrobgm.net/docs/skills) lists every skill.

## Layout

| Path | What it is |
| --- | --- |
| `skills/<name>/SKILL.md` | One skill per folder, shared by Claude and Codex. |
| `skills/_shared/` | Docs several skills read (setup, sign-in, feed flow, eligibility). No `SKILL.md`, so not a skill. |
| `skills/pilot/tasks/` | One file per Pilot task type. |
| `skills/humanizer/` | Makes letters and messages read like a person wrote them. Adapted from [blader/humanizer](https://github.com/blader/humanizer) (MIT). |
| `agents/` | Worker agents that each handle one job, search or contact, keeping browser output out of the main session. |
| `bin/` | `jobpilot-api`, the API client every skill uses. |
| `settings/` | Settings the host passes to Claude and Codex. |
| `.mcp.json` | The Playwright and Upwork MCP servers. |

## Editing

Edit files here directly; there is no build step. Skills name other skills and link shared docs by
relative path (`../_shared/setup.md`), so one text serves both providers. The
[development guide](../docs/development.md) covers how the host loads the plugin and ships it.

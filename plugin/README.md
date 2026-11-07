# JobPilot plugin

This plugin turns Claude Code or Codex into an agent that looks for jobs for
you. It searches job boards, tailors your resume for each posting, fills in
applications, writes cover letters and messages to recruiters, and keeps your
[JobPilot dashboard](https://jobpilot.suxrobgm.net) up to date.

It runs on your computer and uses your own Claude or Codex subscription. Your
profile, resumes, and applications are stored in your JobPilot account, and
the agent reads and updates them through the JobPilot API.

## Install

Install the plugin from your provider's marketplace (the commands are in the
[main README](../README.md#get-started)), then run setup. Setup
installs the terminal host on your computer, starts it, and opens the
dashboard. After that, you start the agent and watch it from the dashboard.

The marketplace version only contains `setup`. The terminal host comes with
the full set of skills and keeps them updated.

## Skills

The main skills are `search`, `auto-apply`, `apply`, `networking`, and
`cover-letter`. The [skills guide](https://jobpilot.suxrobgm.net/docs/skills) lists all of them.

## What's in this folder

| Path | What it is |
| --- | --- |
| `skills/<name>/SKILL.md` | One skill per folder. Claude and Codex read the same file. |
| `skills/_shared/` | Notes that several skills read: setup, signing in, filling forms, browser tips, eligibility. It has no `SKILL.md`, so it doesn't show up as a skill. |
| `skills/pilot/tasks/` | One file for each kind of task the Pilot can take on. |
| `skills/humanizer/` | Edits letters, proposals, and messages so they read like a person wrote them. Adapted from [blader/humanizer](https://github.com/blader/humanizer) (MIT). |
| `agents/` | `job-scorer`, `job-applier`, `job-searcher`, `job-researcher`, and `networking-worker`. Each handles one job, search, or contact at a time, which keeps the browser output out of the main session. |
| `bin/` | `jobpilot-api`, the script every skill uses to call the API. |
| `settings/` | Settings the terminal host passes to Claude and Codex. |
| `.mcp.json` | The Playwright browser server. |

## Editing skills

Edit the files in this folder directly. There's no build step. Skills refer
to other skills by name and to shared notes by relative path
(`../_shared/setup.md`), so the same text works for both providers. The
[development guide](../docs/development.md) explains how the host loads the
plugin and how releases ship it.

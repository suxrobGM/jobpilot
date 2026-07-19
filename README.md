<div align="center">

<img src="apps/web/public/icon.svg" width="96" alt="JobPilot logo" />

# JobPilot

**Plan, run, and track your job search with Claude Code or Codex.**

[![Release](https://img.shields.io/github/v/release/suxrobGM/jobpilot?style=flat&color=FF6A3D)](https://github.com/suxrobGM/jobpilot/releases)
[![CI](https://github.com/suxrobGM/jobpilot/actions/workflows/ci.yml/badge.svg)](https://github.com/suxrobGM/jobpilot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.3-black?logo=bun)](https://bun.sh)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org)
[![.NET](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet)](https://dotnet.microsoft.com)

[**Open JobPilot →**](https://jobpilot.suxrobgm.net) &nbsp;·&nbsp; [Docs](https://jobpilot.suxrobgm.net/docs) &nbsp;·&nbsp; [How it works](docs/architecture.md) &nbsp;·&nbsp; [Changelog](CHANGELOG.md)

</div>

---

JobPilot helps you search for roles, tailor resumes, submit applications, contact
recruiters, and track the results. You can run one task at a time or enable the
Pilot to work through a schedule and limits you define.

> **Uses your subscription, not an AI API key.** Claude Code or Codex performs
> the AI work, so JobPilot uses the limits included with your existing
> subscription. You do not need to provide an Anthropic or OpenAI API key, and
> JobPilot does not add a separate per-token AI charge.

The agent runs on your computer and controls a local browser. The hosted
dashboard stores your profile, resumes, campaigns, and application history. You
can see what the agent is doing and step in when needed.

## What you can do

- **Search and review:** find jobs on supported boards, compare them with your
  resume, and save the best matches for review.
- **Apply:** submit one application or work through an approved queue. JobPilot
  can fill forms, answer screening questions, and prepare job-specific resumes
  and cover letters.
- **Run auto-apply campaigns:** apply to matching jobs up to the score and volume
  limits you set.
- **Use the Pilot:** give JobPilot goals, saved searches, active hours, and daily
  limits. It works through the next available task and keeps a journal of each
  action. When it needs a decision, it asks you.
- **Contact recruiters:** find a relevant contact, draft a tailored message, and
  send it by email or LinkedIn.
- **Track applications:** manage applications from initial submission through
  interviews and offers, with pipeline and analytics views.
- **Manage recruiter email:** connect Gmail to classify replies, match them to
  applications, and suggest pipeline updates for your approval.
- **Work with resumes and Upwork:** maintain resume variants, export PDFs, search
  Upwork jobs, draft proposals, and improve your profile.

JobPilot includes workflows for LinkedIn, Indeed, Glassdoor, Wellfound, Y
Combinator, Hacker News Who's Hiring, We Work Remotely, Remote OK, and other
boards. You can also add a custom board.

## Get started

1. [Create an account](https://jobpilot.suxrobgm.net) and add your profile and
   resume.
2. Install the JobPilot plugin for Claude Code or Codex using the instructions
   below.
3. Run the `setup` skill. It installs the local terminal companion, starts the
   agent, and opens the dashboard.
4. Start with a search campaign. Review the matches, then apply to selected jobs
   or create an auto-apply campaign.

### Install the plugin

#### Claude Code

Run these commands in Claude Code:

```text
/plugin marketplace add https://github.com/suxrobgm/claude-plugins
/plugin install jobpilot@sukhrob-claude-plugins
/jobpilot:setup
```

#### Codex

Run these commands in a shell:

```text
codex plugin marketplace add suxrobGM/codex-plugins
codex plugin add jobpilot@sukhrob-codex-plugins
```

Start a new Codex session, then run:

```text
$setup
```

After setup, you can launch the agent from the agent dock in the dashboard.

### Install the terminal companion manually

Use one of these commands if you need to install or repair the terminal
companion without running the setup skill. The JobPilot plugin is still required
to launch Codex from the dashboard.

- **Windows (PowerShell):** `irm https://raw.githubusercontent.com/suxrobGM/jobpilot/main/apps/terminal/install.ps1 | iex`
- **macOS / Linux:** `curl -fsSL https://raw.githubusercontent.com/suxrobGM/jobpilot/main/apps/terminal/install.sh | bash`

For a guided walkthrough, see the
[getting-started guide](https://jobpilot.suxrobgm.net/docs/getting-started).

## Skills

Skills are the commands JobPilot adds to Claude Code and Codex. The command name
is the same in both; only the prefix changes:

```text
/jobpilot:auto-apply senior typescript remote
$auto-apply senior typescript remote
```

In Codex, use `/skills` to browse installed skills. To run one directly, use the
`$<skill>` form, such as `$search` or `$setup`.

| Skill               | Purpose                                                                         |
| ------------------- | ------------------------------------------------------------------------------- |
| **Pilot**           |                                                                                 |
| `pilot`             | Run one Pilot cycle. The Pilot host calls this skill automatically.             |
| **Campaigns**       |                                                                                 |
| `search`            | Search a board, rank results against your resume, save them for review.         |
| `auto-apply`        | Search and apply autonomously, one job at a time, until done or capped.         |
| `apply`             | Apply to one job (URL or pasted posting) with a fit review, or drain the queue. |
| `resume`            | Resume an interrupted campaign and finish its remaining approved jobs.          |
| `rescan-skipped`    | Re-score a campaign's skipped jobs and promote the wrongly dropped ones.        |
| `networking`        | Find the hiring manager or recruiter and send a personalized message.           |
| **Writing**         |                                                                                 |
| `cover-letter`      | Draft a natural, job-specific one-page cover letter.                            |
| `interview`         | Build a prep sheet: behavioral, technical, system design, company.              |
| `tailor-resume`     | Pick or create the best resume variant for a job (runs automatically).          |
| `extract-resume`    | Parse an uploaded resume PDF into the structured editor.                        |
| **Email**           |                                                                                 |
| `scan-inbox`        | Classify new mail, match it to applications, propose stage moves.               |
| `get-code`          | Pull the latest verification code or magic link for a board domain.             |
| **Upwork**          |                                                                                 |
| `upwork-search`     | Search Upwork, filter out low-quality clients, rank the rest.                   |
| `upwork-proposal`   | Draft a short, targeted Upwork proposal.                                        |
| `upwork-profile`    | Improve your Upwork overview and portfolio; writes back on approval.            |
| **Setup & helpers** |                                                                                 |
| `setup`             | Install, start, or update the local agent terminal.                             |
| `solve-captcha`     | Solve captchas - free vision path first, token service fallback.                |
| `humanizer`         | Make generated text sound more natural; used by the writing skills.             |

Inbox scanning, verification codes, and networking emails require your own Google
OAuth client. Follow the
[email setup guide](https://jobpilot.suxrobgm.net/docs/email-setup) to connect
it.

## Documentation

- [User documentation](https://jobpilot.suxrobgm.net/docs) - setup, campaigns,
  skills, email, credentials, and common questions.
- [How JobPilot works](docs/architecture.md) - a non-technical overview of the
  dashboard, local agent, and terminal companion.
- [Development guide](docs/development.md) - local setup, repository layout,
  technical architecture, and contribution notes.

## License

MIT. The shared humanizer skill is based on the bundled upstream humanizer
package under [plugin/skills/humanizer/](plugin/skills/humanizer/), which ships
with its own LICENSE file.

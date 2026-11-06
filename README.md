<div align="center">

<img src="apps/web/public/icon.svg" width="96" alt="JobPilot logo" />

# JobPilot

**An AI agent that applies to jobs for you, using the Claude or Codex subscription you already have.**

[![Release](https://img.shields.io/github/v/release/suxrobGM/jobpilot?style=flat&color=FF6A3D)](https://github.com/suxrobGM/jobpilot/releases)
[![CI](https://github.com/suxrobGM/jobpilot/actions/workflows/ci.yml/badge.svg)](https://github.com/suxrobGM/jobpilot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.4-black?logo=bun)](https://bun.sh)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org)
[![.NET](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet)](https://dotnet.microsoft.com)

[**Open JobPilot →**](https://jobpilot.suxrobgm.net) &nbsp;·&nbsp; [Docs](https://jobpilot.suxrobgm.net/docs) &nbsp;·&nbsp; [How it works](docs/architecture.md) &nbsp;·&nbsp; [Changelog](CHANGELOG.md)

[![Watch the teaser](docs/images/teaser.gif)](apps/web/public/teaser.mp4)

*[Watch it full size →](https://jobpilot.suxrobgm.net#see-it-run)*

</div>

---

Applying for jobs takes hours. You fill in the same forms, adjust your resume
for every posting, and keep track of who replied. JobPilot gives that work to
an AI agent on your computer. You tell it what kind of job you want. It
searches job boards, tailors your resume for each posting, fills in and sends
the application, writes to recruiters, and keeps track of the replies. The
JobPilot website shows where every application stands.

> You don't need an API key, and there's no usage bill. The agent runs inside
> Claude Code or Codex, so it uses the subscription you already pay for.

The agent works in a normal browser window on your computer, signed in as
you. You can watch it, or leave it alone and check what it did later.

## What it does

- **Applies to jobs.** It searches LinkedIn, Indeed, Hiring Cafe, and other
  boards, and you can add your own. Each job gets a score against your
  resume. It can apply to the jobs you pick, or work through a list on its own
  up to a limit you set. It answers screening questions and writes cover
  letters along the way.
- **Works like an assistant.** You write down your goals and a few rules, and
  with autopilot on it keeps finding jobs, applying, and following up. Tell
  it what to change in plain words and it does it, with Undo. If it needs a
  decision from you, it sends a notification to your phone, and you can watch
  any task step by step from there too.
- **Reaches out to people.** It finds the recruiter or hiring manager for a
  job and writes them a personal email or LinkedIn message. If you connect
  Gmail, it reads the replies, matches them to your applications, and
  suggests what to do next. Nothing is sent without your approval.
- **Keeps track.** Every application sits in one list, from applied to offer,
  with charts on top. Each tailored resume is saved as its own PDF, so you
  know which version went to which company.
- **Works on Upwork.** Through Upwork's own connector, it finds jobs, skips
  clients who rarely hire, drafts proposals you send with one click, and
  collects your invitations, offers, and messages.

## Get started

You need a Claude Code or Codex subscription and [Node.js](https://nodejs.org)
22 or newer.

1. Install the JobPilot plugin in Claude Code or Codex (commands below).
2. Run setup. It installs a small program called the terminal host, starts
   the agent, and opens the dashboard. If the host is already installed, setup
   updates it.
3. [Create an account](https://jobpilot.suxrobgm.net) and upload your resume.
   The agent reads it and fills in your profile.
4. Write your goals on the Pilot page and turn on autopilot. Or leave it off
   and ask for a search first to check the matches.

> Claude Code starts on the latest Sonnet model and Codex on GPT 6 Luna. Bigger
> models use up your weekly limit much faster and don't send any more
> applications. [Here's why](https://jobpilot.suxrobgm.net/docs/faq).

### Install the plugin

#### Claude Code

Run these in Claude Code:

```text
/plugin marketplace add https://github.com/suxrobGM/claude-plugins
/plugin install jobpilot@sukhrob-claude-plugins
/jobpilot:setup
```

#### Codex

Run these in a terminal:

```text
codex plugin marketplace add suxrobGM/codex-plugins
codex plugin add jobpilot@sukhrob-codex-plugins
```

Then start a new Codex session and run:

```text
$setup
```

Once setup is done, you can start the agent from the agent drawer, opened by
the agent button at the bottom of the sidebar.

<details>
<summary><b>Install the terminal host without the plugin</b></summary>

Use one of these to install or repair the terminal host without running
setup. The host ships with all the skills and the browser settings the agent
needs. The plugin from the marketplace only exists to run setup the first
time.

- **Windows (PowerShell):**

  ```powershell
  irm https://raw.githubusercontent.com/suxrobGM/jobpilot/main/apps/terminal/install.ps1 | iex
  ```

- **macOS / Linux:**

  ```bash
  curl -fsSL https://raw.githubusercontent.com/suxrobGM/jobpilot/main/apps/terminal/install.sh | bash
  ```

</details>

For a step-by-step walkthrough, read the
[getting started guide](https://jobpilot.suxrobgm.net/docs/getting-started).

## Skills

You only ever type one command:

```text
/jobpilot:setup     # Claude Code
$setup              # Codex
```

It installs the terminal host, starts the agent, and opens the dashboard. If
the host is already installed, it updates it, so you can run it again whenever
you want to update or fix your install.

Everything else starts from the website. Buttons ask the Pilot for that
work, it runs next on your agent, and you can watch it in the agent drawer:

| On the website                     | What the agent does                                                   |
| ---------------------------------- | --------------------------------------------------------------------- |
| Pilot → message box                | Answers you, changes goals, rules or searches, or queues work.        |
| Pipeline → Apply now               | Applies to that job.                                                  |
| Pipeline → Retry                   | Tries the failed applications again.                                  |
| Pipeline → Rescan                  | Checks skipped jobs again in case they were skipped by mistake.       |
| Inbox → Scan pending               | Sorts new email, matches it to applications, suggests status changes. |
| Networking → Find contacts         | Finds recruiters or hiring managers and drafts a message to each.     |
| Networking → Rewrite               | Writes a new version of the selected draft messages.                  |
| Resume → Extract from PDF          | Reads an uploaded PDF into your resume editor.                        |
| Resume → Tailor                    | Rewrites a copy of your resume for one job posting.                   |
| Upwork → Proposal                  | Drafts a proposal for one job.                                        |
| Upwork → Submit                    | Sends a draft proposal after showing you the Connects cost.           |
| Upwork → Profile                   | Suggests a better title, overview, and skills; saves them if you agree. |
| Upwork → Sync                      | Brings in invitations, offers, messages, and your Connects balance.   |

You can also type any skill into the terminal yourself, like
`/jobpilot:search` or `/jobpilot:apply <link>`.

Some skills run in the middle of other work, and you never start them
yourself. The agent uses them to tailor your resume before applying, write a
cover letter, solve a captcha, or read a sign-in code from your email. The
[full list](https://jobpilot.suxrobgm.net/docs/skills) covers
every skill.

Reading replies, picking up sign-in codes, and sending networking emails all
need a Google OAuth client that you create. The
[email setup guide](https://jobpilot.suxrobgm.net/docs/email-setup) walks you
through it.

## Documentation

- [User guide](https://jobpilot.suxrobgm.net/docs): setup, the Pilot, skills,
  email, credentials, and the FAQ.
- [How JobPilot works](docs/architecture.md): a plain-language overview of
  the website, the agent, and the terminal host.
- [Development guide](docs/development.md): running JobPilot locally, the
  repository layout, and technical details for contributors.

## License

MIT. The humanizer skill in
[plugin/skills/humanizer/](plugin/skills/humanizer/) is adapted from
[blader/humanizer](https://github.com/blader/humanizer) (MIT) and keeps its
own LICENSE file.

# How JobPilot works

A plain-language tour of what JobPilot is made of and what happens when you
use it. No programming knowledge needed - if you want the technical
internals, see [development.md](development.md).

## The big picture

JobPilot is split into two halves:

- **The dashboard** lives in the cloud. It's the website where you sign up,
  fill in your profile, manage resumes, start campaigns, and track every
  application from "applied" to "offer".
- **The agent** lives on your computer. It's an AI assistant - Claude Code or
  Codex, running on **your own subscription** - equipped with the JobPilot
  plugin. It opens a real browser on your machine and does the actual work:
  searching job boards, tailoring your resume, filling out application forms,
  and messaging recruiters.

```text
        In the cloud                          On your computer
  ┌──────────────────────┐             ┌───────────────────────────┐
  │  JobPilot dashboard  │ ◄────────►  │  AI agent (Claude/Codex)  │
  │  profile · resumes   │             │  + JobPilot plugin        │
  │  campaigns · inbox   │             │  + a real web browser     │
  └──────────────────────┘             └───────────────────────────┘
```

Why the split? Three reasons:

1. **Your subscription, your cost.** The AI runs on the Claude or Codex plan
   you already pay for - JobPilot doesn't resell AI usage or meter tokens.
2. **Your browser, your identity.** Applications are submitted from a real
   browser on your own computer, logged in as you - not from a bot farm in a
   data center.
3. **You can watch.** The browser opens right in front of you. Every search,
   click, and form fill happens on your screen, and you can step in anytime.

## The three parts

### 1. The dashboard (the website)

The hosted web app at [jobpilot.suxrobgm.net](https://jobpilot.suxrobgm.net).
This is where your data lives: your profile, resumes and tailored variants,
campaigns, the application pipeline, recruiter inbox, outreach contacts, and
analytics. It also has a built-in terminal panel (the "agent dock") where you
can see and control the agent running on your machine.

### 2. The agent (the plugin)

The JobPilot plugin teaches Claude Code or Codex a set of **skills** -
commands like `search`, `auto-apply`, `cover-letter`, or `outreach`. When you
run one, the agent:

- reads your profile and resume from the dashboard,
- drives a real browser to do the work (search, log in, fill forms),
- writes the results back, so your pipeline updates in real time.

The same plugin works in both Claude Code and Codex - install it in whichever
one you use.

### 3. The terminal companion (the bridge)

A small helper program that runs quietly on your computer. It keeps the agent
session alive and connects it to the dashboard, so the terminal panel on the
website shows the agent working on your machine - and buttons on the website
can send it commands. It also hands the agent a secure token when it starts,
so the agent acts as _you_ without any manual setup.

You don't interact with it directly: the `setup` skill (or the dashboard's
agent dock) installs and starts it for you.

## What happens when you run a campaign

Say you run `auto-apply senior typescript remote`:

1. **The agent checks in** with the dashboard and loads your profile,
   preferences, and default resume.
2. **It opens a browser** on your machine and searches the job board you
   chose, logging in with your saved credentials if needed.
3. **It scores each job** against your resume and skips ones that don't fit,
   duplicates you've already applied to, and low-quality postings.
4. **For each match, it applies** - picking or tailoring the right resume
   variant, filling out the form, answering screening questions, and writing
   a cover letter when one is requested.
5. **It reports back** after every job, so the campaign page on the dashboard
   updates live: applied, skipped, or failed, with a reason.
6. **Your pipeline grows.** Every submitted application lands in the tracker,
   and later recruiter replies in your inbox get matched to it automatically.

Depending on the campaign mode, the agent either asks you to review matches
first (`search`, `apply`) or proceeds on its own up to a cap you set
(`auto-apply`).

## The Pilot: fully autonomous mode

Everything above still works by hand, but you can also hand the whole loop
over. Write your instructions once - goals, daily caps, active hours, saved
searches, how much autonomy to give outreach, which platforms you're okay
posting to - and the Pilot takes it from there, repeating one cycle forever
while it's enabled:

```text
  sense ──► decide ──► act ──► record ──► exit
    ▲                                        │
    └──── PilotConductor re-injects ◄────────┘
```

- **Sense** - the agent asks the dashboard for its agenda: a prioritized list
  compiled fresh from your data every time it's asked (jobs to apply to,
  replies to review, follow-ups due, an interview invite awaiting a reply) -
  there's no separate task queue or server-side cron job ticking in the
  background.
- **Decide** - it takes the single top item.
- **Act** - it leases that item - a short-lived claim with a timeout, so a
  crash never leaves it stuck mid-work - then does the one thing: apply to a
  job, send an outreach follow-up, draft an interview reply, and so on.
- **Record** - every action lands in a live journal you can read like a diary
  of what the agent did and why.
- **Exit** - the cycle prints a sentinel line (`[[JOBPILOT_CYCLE ...]]`) and
  stops. A small watchdog on your machine, the **PilotConductor**, drives the
  loop from there: it reads the sentinel and starts the next cycle. If a
  cycle goes quiet or gets stuck, the conductor nudges it, then restarts it -
  the lease timeout makes sure any half-finished work is picked back up.

Two things make this run without a browser tab open: **one-time pairing**
stores your login token securely with the host the first time you enable the
Pilot, so it can start its own sessions after a reboot or crash; and a live
SSE connection lets the dashboard push the agent an instant wake-up the
moment something time-sensitive happens, instead of it waiting for the next
scheduled check.

Anything the Pilot isn't sure about - a salary question, an unexpected form
field, an interview invite - is sent to your phone as a question, delivered
as a one-tap card, and the affected job is parked until you answer. The
important limits aren't just instructions to the AI: daily apply/outreach
caps, "never send a LinkedIn message automatically," and "never publish a
post without my approval" are enforced by the dashboard itself, so they hold
even if a cycle goes off-script.

## Where your data lives

- **Profile, resumes, applications, campaigns** are stored by the hosted
  dashboard, in your account.
- **Secrets are encrypted per user.** Job-board passwords and tokens are
  stored encrypted with a key unique to your account.
- **Browsing happens only on your machine.** The cloud never logs into job
  boards for you - all board sessions, cookies, and form submissions stay in
  the browser on your computer.
- **AI usage stays on your plan.** Your prompts and the agent's work go
  through your own Claude or Codex subscription, not through JobPilot's
  servers.

## Live updates

While the agent works, every open dashboard page keeps itself current: the
campaign page shows per-job progress, the pipeline shows new applications,
and the inbox shows newly matched replies - no refreshing needed.

## Want to go deeper?

- [development.md](development.md) - run JobPilot locally, repository layout,
  tech stack, and the technical internals behind everything above.
- [User docs](https://jobpilot.suxrobgm.net/docs) - getting started,
  campaigns & skills, email setup, credentials, FAQ.

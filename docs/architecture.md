# How JobPilot works

What JobPilot is made of and what happens when it applies for you. No coding
knowledge needed. For technical details, see [development.md](development.md).

## Two halves

- **The website** holds your account: profile, resumes, the Pilot, your
  pipeline of jobs and applications, recruiter emails, and networking
  contacts.
- **The agent** runs on your computer. It's Claude Code or Codex, on your own
  subscription, with JobPilot's skills. It opens a browser on your machine and
  does the work: searching boards, tailoring resumes, filling in applications,
  writing to recruiters.

```text
          Website                              Your computer
  ┌──────────────────────┐             ┌───────────────────────────┐
  │  JobPilot website    │ ◄────────►  │  AI agent (Claude/Codex)  │
  │  profile · resumes   │             │  + JobPilot skills        │
  │  pilot · pipeline    │             │  + a web browser          │
  └──────────────────────┘             └───────────────────────────┘
```

Why it's split this way:

1. The AI runs on the plan you already pay for, so JobPilot doesn't sell AI
   usage.
2. Applications go out from a browser on your computer, signed in as you, not
   from a server.
3. You can watch that browser and step in at any time.

## The terminal host

A small program on your computer that keeps the agent's session running and
connects it to the website. It's how the website shows the agent at work and
how the Pilot hands it tasks. It also gives the agent a token to act as you,
so there's nothing to configure.

Setup installs and starts it. You start it again from the agent drawer.

## What happens when it applies

Say your goals ask for "senior TypeScript, remote":

1. The Pilot turns your goals into a few named searches.
2. A search runs: the agent opens a job board in the browser, signing in with
   your saved login if needed.
3. It scores each job against your resume and skips ones that don't fit, hit
   a deal-breaker, are already in your pipeline, or look low quality. Every
   job lands in your pipeline either way, with the reason.
4. For each good match, it picks or makes the right resume, fills in the form,
   answers screening questions, and writes a cover letter if asked.
5. The application shows under **Applied**. When the recruiter replies, the
   reply is matched to it.

## The Pilot's loop

The Pilot repeats the same loop while the agent runs:

```text
  check for work ──► start a task ──► agent works ──► agent reports
        ▲                                                   │
        └──────────── wait, then check again ◄──────────────┘
```

- **Check for work.** The terminal host asks the server for a task list. The
  server builds it fresh from your data each time: your messages, work you
  asked for, jobs to apply to, replies to read, follow-ups due. With
  autopilot off, only what you asked for is on it. If it's empty, the AI
  doesn't start.
- **Start a task.** The host takes the top task, clears the agent's memory,
  and gives it that one task.
- **Agent works.** One thing: apply to one job, answer your message, draft one
  reply. Results are saved as it goes, and each action becomes a short step
  you can watch from any device.
- **Agent reports.** It reports the outcome in a line. The server adds it to
  the Pilot's thread. If the agent gets stuck, the host nudges it, then
  restarts the session; an application it didn't finish goes back on the
  list.

The host keeps a live connection to the server, so a button you press starts
work right away. If you type in the terminal yourself, it waits a few minutes
before starting anything new.

## Rules it can't break

When the Pilot needs a decision, like a salary question or an interview
invite, it asks you, and the job waits. It only suggests changes to your
goals, rules, and saved answers, and every change has Undo.

The rules that matter most are enforced by the server, not just told to the
AI: your daily application and networking limits, never sending a LinkedIn
message on its own, and never publishing a post without approval. They hold
even if the AI makes a mistake.

Resumes work the same way. `extract-resume` copies your PDF as written.
`review-resume` suggests an improved version for you to accept or reject.
`tailor-resume` makes a per-job copy. None of them can add an employer, a
date, or a number your resume doesn't have; the server checks every rewrite
and flags what it can't confirm.

## Where your data lives

- Profile, resumes, applications, and searches: your JobPilot account.
- Job board passwords and tokens: encrypted with a key that belongs only to
  your account.
- Board sessions, cookies, and form submissions: the browser on your
  computer. The website never signs in to job boards.
- AI work: your own Claude or Codex subscription, not JobPilot's servers.

Every open page updates by itself as the agent works, so you never need to
refresh.

## Further reading

- [User guide](https://jobpilot.suxrobgm.net/docs): setup, the Pilot,
  skills, email, credentials, FAQ.
- [development.md](development.md): running JobPilot locally and the
  technical details.

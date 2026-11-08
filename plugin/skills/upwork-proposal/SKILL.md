---
name: upwork-proposal
description: Write a short Upwork proposal from a job description and the user's resume, in a plain human voice that doesn't repeat the user's recent proposals.
argument-hint: "<proposal_id | job_description>"
---

# Upwork proposal

Clients skim proposals on their phones; one that takes more than about 30 seconds is gone. Write
for that: their problem first, one piece of proof, one question.

## Setup

Follow `../_shared/setup.md`, then `GET /api/resumes/<user.primaryResumeId>` and write from its
`content`.

The argument is either:

- **A proposal id**: `GET /api/upwork/proposals/<id>`. Use its `jobDescription`, with `jobTitle`,
  `clientName` and `jobUrl` for context.
- **A job description**: there's no row yet; step 5 creates one.

## 1. Read the job and recent proposals

Note what the client needs built or fixed, the tech, scope and timeline, and any direct questions.
Pick one detail unique to this posting to show you read it.

`GET /api/upwork/proposals --query page=1 --query limit=5`; from each `.items[].proposalText`, note
the first line, the project it used, and the closing question.

## 2. Pick one case study

The one resume project that matches their problem, not just their stack; keep its link. Prefer a
different project from the last two proposals when another fits as well.

## 3. Write

Under 150 words:

1. **Hook**, line 1, in `**bold**` (Upwork renders it, and it is what gets read): the closest thing
   you've done to their problem ("I built the Stripe Connect payouts for a two-sided marketplace
   last year."). Don't paraphrase their posting. Not "Hi", "Dear client", "I'm excited to apply".
2. **Proof**, one or two lines: what you built, one real result, the link.
3. **Question**, one line: a specific question about their project (a scope choice, an edge case,
   a decision they face). It is the call to action; nothing after it. A calendar link instead only
   if the profile has one.

Match their tone. No Top Rated or JSS mentions unless asked. No lists, headers or emoji. Don't
reuse a recent first line or closing question.

Screening questions: short and direct. "How many years with React?" gets "4 years, most recently
on <project>."

Then run the `humanizer` skill in embedded mode on the proposal and on the answers.

## 4. Save

Write `$JOBPILOT_TEMP/proposal.json`. `screeningAnswers` is `[{ "question", "answer" }]` or `[]`.

- From an id: `{ "proposalText", "screeningAnswers" }`; it stays a draft.

  ```bash
  jobpilot-api PATCH /api/upwork/proposals/<id> --data @"$JOBPILOT_TEMP/proposal.json"
  ```

- From a description: `{ "jobTitle", "clientName", "jobUrl", "jobDescription", "proposalText",
  "screeningAnswers" }`. `jobTitle` is required; include `clientName` and `jobUrl` when known.

  ```bash
  jobpilot-api POST /api/upwork/proposals --data @"$JOBPILOT_TEMP/proposal.json"
  ```

Print the proposal and each answer under its question, ready to paste. Every project, metric and
link comes from the resume.

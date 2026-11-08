---
name: cover-letter
description: Write a short cover letter (150-250 words) for a job from the user's resume, in a plain human voice that doesn't repeat the user's recent letters.
argument-hint: "<job_description>"
---

# Cover letter

Write the letter a good candidate would write in fifteen minutes: short, specific, plain. The
reader should learn one or two real things about the candidate and want to talk to them.

## Setup

Follow `../_shared/setup.md`, then `GET /api/resumes/<id>` (the caller's `resumeId`, else
`user.primaryResumeId`). Write from its `content`, not the PDF: inside an apply loop the PDF costs
several times more per job.

## 1. Read the job

Note the company and what it does, the role and level, the two or three things it most needs, the
stack and domain, and the tone (casual startup or formal enterprise).

## 2. Read the last five letters

Letters that are each fine but all the same shape are what reads as AI. Don't skip this.

```bash
jobpilot-api GET /api/cover-letters --query page=1 --query limit=5
```

Fetch each with `GET /api/cover-letters/<id>`. Note only what it led with, its first and last
sentences, and how it phrased its numbers. No history: go on.

## 3. Choose what to say

One lead, the strongest for this job:

- the result closest to their main need (for senior roles: scope, architecture, what the team
  shipped);
- direct experience with their stack, domain or product (for research roles: publications);
- a real reason for this company, only if the resume or posting gives one.

Don't lead with what either of the last two letters led with, unless the job leaves no honest
alternative. Then one or two proof points that fit this job: a named project or role with one
concrete detail each.

## 4. Write

Header from `user.*` only (resumes carry stale addresses); drop empty lines:

```text
<Full name>
<City, State> | <Phone> | <Email>
<LinkedIn> | <GitHub> | <Website>
```

Body: 150-250 words in three or four paragraphs of different lengths.

- **Open** with the lead in one to three sentences. Name the role somewhere, not necessarily
  first: "I'm applying for the X role at Y" is the opening every letter uses.
- **Proof** in one or two short paragraphs: what you did and what happened. Don't explain why it's
  relevant.
- **Close** in one or two sentences: you'd like to talk. A thank-you is fine; no recap.

Quote at most one short phrase from the posting. First person, resume facts only, in the company's
tone. Sign off with "Best regards," and the full name.

## 5. Humanize and compare

Run the `humanizer` skill on the letter in embedded mode. Then compare with the step 2 notes and
fix any match:

- no reused sentence, including how a metric is phrased (reuse the number, not the sentence);
- a different first and last sentence;
- the company mentioned in a different place;
- a different overall shape: if recent letters went intro, experience, tech, why-company, close,
  merge or drop a section.

## 6. Save

Best effort; continue if it fails. Write `{"content","jobUrl","jobTitle","company","source"}` to
`$JOBPILOT_TEMP/cover-letter.json`, omitting empty job fields. `source` is the caller: `apply`,
`auto_apply`, or `manual` (default).

```bash
jobpilot-api POST /api/cover-letters --data @"$JOBPILOT_TEMP/cover-letter.json"
```

Return the plain-text letter with header and sign-off.

---
name: tailor-resume
description: Choose the best existing resume base/variant for a job, or create a new tailored variant when nothing fits.
argument-hint: "<brief-json | job-url | pasted-jd-text> [--base <resumeId>]"
---

# Tailor resume

Pick a resume for one job: reuse a variant when one fits, create one only when none does.

Follow `../_shared/setup.md`; the profile carries `resumes`.

## 1. Read the job

- Argument starts with `{`: it is the brief. No browsing.
- Starts with `http`: open it, snapshot the posting body, and build the brief
  (`../_shared/job-brief.md`).
- Otherwise: pasted text; build the brief from it.

From the brief, derive:

- `title`; `domain` (fintech, healthtech, devtools, ...); `standouts` (clearance, on-call, onsite).
- `roleFamily`, one of `frontend` (frontend, ui, react, vue, angular), `backend` (backend, api,
  services), `fullstack`, `mobile` (ios, android, react native, flutter), `data` (data
  engineer/scientist, analytics, etl), `ml` (ml, ai engineer, mlops), `devops` (devops, sre,
  platform, infrastructure), `qa` (qa, sdet, test engineer), or `other`.
- `seniority`, one of `junior` (junior, entry), `senior` (senior, sr.), `staff`, `lead` (lead,
  principal), else `mid`. Cross-check `yearsExperience`: 0-2 junior, 3-5 mid, 6-9 senior, 10+
  staff or lead.
- `keywords`: the top 10 required skills from `skills` and `requirements`, lowercase, deduped,
  must-haves first.
- `responsibilityTerms`: the top 5 terms from `responsibilities` (design, mentor, migrate,
  on-call).

## 2. Pick the base

A resume is usable when it has `hasData` or a `sourceFilename`.

1. `--base <id>` (the feed's resume), if usable.
2. Else `user.primaryResumeId`, if usable.
3. Else score each resume (max 10) and take the highest; ties go to primary, then most recent, then
   lowest id:
   - +4 its `label` names `roleFamily`; or +2 an adjacent family (frontend/fullstack,
     backend/fullstack, ml/data, devops/backend);
   - +1 `hasData`; +1 `isPrimary`; +1 updated within 90 days;
   - +0 to 3 keyword coverage when `hasData`: `round(3 x matched / 10)` over skills, projects and
     summary.

Nothing usable: stop with "No usable base resume. Upload a PDF at $JOBPILOT_WEB/resumes, then run
this again."

## 3. Load the base

`GET /api/resumes/$BASE_ID`. `content` null: run the `extract-resume` skill on it, then fetch
again.

A non-empty `profileMismatches` means the resume and profile disagree. Say it once, don't block:

> Resume and profile disagree: <field> is "<resume>" on the resume, "<profile>" in the profile.
> Fix at $JOBPILOT_WEB/resumes/<baseId>

## 4. Reuse or create

`GET /api/resumes/$BASE_ID/variants`. Rank by title similarity and fetch only the top 5 (`GET
/api/resumes/variants/<id>`). Skip `Suggested rewrite` variants. A variant outside `roleFamily`
and its adjacent families scores 0. Otherwise score out of 100:

| Part | Max | How |
| --- | --- | --- |
| Keywords | 40 | `40 x matched / 10` of `keywords` in skills, project keywords, summary, bullets |
| Title | 20 | `20 x` word overlap (Jaccard) of the job title and variant label, ignoring engineer, senior, the, at |
| Responsibilities | 15 | `15 x matched / 5` of `responsibilityTerms` in summary and bullets |
| Seniority | 15 | exact 15; one step off 8; else 0 |
| Domain | 5 | `domain` appears in summary or a bullet |
| Recency | 5 | updated within 180 days |

- 60 or more: reuse.
- 45-59: reuse, and name the weakest part in one line.
- Under 45, or nothing passes the family check: create (step 5).
- At 15 or more variants on the base: reuse the best variant that passes the family check, whatever
  its score, and say "Reusing variant <id> (<n>/100): the base has <count> variants. Prune at
  $JOBPILOT_WEB/resumes/<baseId>."

Reuse is the default. A variant is the base with bullets reordered, so a new one gains little and
adds a row per application. Recency weighs almost nothing on purpose.

On reuse, print and stop:

```text
Reusing variant <id>: <label> (<n>/100).
RESUME_USED base=<baseId> variant=<id>
```

## 5. Create

A variant is the base with the relevant parts moved forward. The reader should see that it fits,
not that it was tailored. The server reorders skills and ranks bullets from your hints, so most of
the work is choosing terms. Send only what changes something:

- `label`: `"<Company> - <Title>"`.
- `jobUrl`: whenever there is one; it ties the variant to the application.
- `emphasizedTech`: 4-8 lowercase terms from `keywords`; they move to the front of their groups.
- `jobKeywords`: optional, about 10 terms that rank bullets in each entry. Defaults to
  `emphasizedTech`.
- `changeNotes`: one or two sentences on what was emphasized and why.

### Summary

Leave `summary` out when the base fits; it usually does. When one sentence speaks to the wrong
audience, swap only that sentence and keep the rest word for word. The new sentence states one
resume fact this job cares about, matching its neighbors in person, tense and length. Keep the
base's proof (publications, years, domains, numbers). Never restate the posting, and never open
with a title followed by a list of tools.

The server rejects stock phrasing in anything you write (summary, headline, reworded bullets).
Don't use: passionate, enjoys, comfortable with, hands-on, results-driven, detail-oriented,
self-starter, fast-paced, track record, cutting-edge, state-of-the-art, leverage, spearheaded,
seasoned, stakeholders, business requirements, production-grade, best practices,
cross-functional, end-to-end, quick learner, eager to, thrives, suited to, the same, downstream.

### Headline

Optional: a job title, nothing more. Change it only when the base names a different discipline.

### Bullet rewrites

Reordering usually suffices. Reword a bullet only when its relevant fact sits mid-sentence, and at
most two or three in the whole resume.

`bulletRewrites` is `[{ entryIndex, bullets: [{ original, tailored }] }]`. `original` is copied
verbatim from `experience[entryIndex].bullets`. `tailored` is the same sentence with the relevant
fact first, starting with a verb (not "Using X,"). Every noun, number and tech name stays; nothing
is added. A concrete noun never becomes a vaguer one ("clinical notes" never becomes "unstructured
records").

### Structure

Only when reordering and rewording can't close the gap: the base's family differs from the job, or
no variant scored above 40. Every move is one more thing to defend in an interview.

- `entryOrder`: a permutation of the remaining indices.
- `dropEntries`: at most half, never all.
- `mergeEntries`: `[{ into, from[], company?, title? }]`, for short or overlapping roles.
  `company` is one of the merged employers or an umbrella (`Independent / Contract`, `Freelance`,
  `Self-employed`, `Independent Software Development`). The server derives the dates.
- `promoteProjects`: `{ projects[], company?, title? }` puts projects on the timeline. Each needs a
  `start` on the base first (`PUT /api/resumes/<id>`). Umbrella `company` only.
- `projectOrder`: listed projects move to the front.

Indices refer to the base. The server applies merge, drop, promote, then reorder;
`bulletRewrites` indices refer to the result.

### Send

Write `$JOBPILOT_TEMP/tailor.json`, then:

```bash
jobpilot-api POST /api/resumes/$BASE_ID/tailor --data @"$JOBPILOT_TEMP/tailor.json"
```

A plain reorder:

```json
{ "label": "Acme - Frontend Engineer", "jobUrl": "<url>",
  "emphasizedTech": ["typescript", "react", "next.js", "aws"],
  "changeNotes": "Surfaced React and Next.js ahead of other tech." }
```

With a swapped summary sentence and one reword:

```json
{ "label": "Acme - Frontend Engineer", "jobUrl": "<url>",
  "emphasizedTech": ["typescript", "react", "next.js", "aws"],
  "summary": "<base summary with one sentence swapped>",
  "bulletRewrites": [{ "entryIndex": 0, "bullets": [{ "original": "<verbatim>", "tailored": "<same facts, relevant one first>" }] }],
  "changeNotes": "Swapped the summary's last sentence for the HIPAA work; led the EmTech entry with the NLP bullet." }
```

With a restructure:

```json
{ "label": "Acme - ML Engineer", "headline": "Machine Learning Engineer",
  "emphasizedTech": ["pytorch", "computer vision", "python"],
  "structure": { "mergeEntries": [{ "into": 2, "from": [3], "company": "Independent / Contract" }],
    "promoteProjects": { "projects": [4] }, "entryOrder": [0, 1, 2] },
  "changeNotes": "Merged two overlapping 2020-21 roles; promoted the CV research project; led with ML." }
```

A `422` lists in `details` every field that states more than the resume, loses a fact, or reads
like a job ad (`structure` is checked first, on its own). Fix them together by sending less: drop
the summary or the rewrite rather than rephrasing a third time. Never work around a rejection.

The response is `{ id, pdfUrl, rewordedBullets, flags }`. Print:

```text
Created variant <id> from base <baseId> (<rewordedBullets> reworded).
RESUME_USED base=<baseId> variant=<id>
```

Add `Check: <flags>` when `flags` is non-empty (for now, a new title sharing no word with the old
one); the candidate will be asked about it.

## Return

Every path ends with the `RESUME_USED` line. Apply flows read it to record what was submitted. Omit
`variant=` only when the base PDF itself goes to the form.

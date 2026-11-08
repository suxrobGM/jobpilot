---
name: review-resume
description: Review a freshly uploaded resume and save a stronger rewritten version as a suggestion the user accepts or discards in the dashboard.
argument-hint: "<resumeId>"
---

# Review resume

Save one improved version of a base resume as a `Suggested rewrite` variant. The user accepts or
discards it in the dashboard. Never write to the base.

It runs after `extract-resume`, which copies the PDF faithfully, weaknesses included. This pass
makes the document better.

## Setup

Follow `../_shared/setup.md`, then `GET /api/resumes/$RESUME_ID`. `content` null: extraction
hasn't run; say so and stop. Also read the source PDF (`GET /api/resumes/$RESUME_ID/source --out
"$JOBPILOT_TEMP/$RESUME_ID-source.pdf"`): extraction flattens columns and drops emphasis.

## What to improve

Write for a human skimming and for ATS parsing. Change only what is weak; where the candidate's
own wording works, keep it. Rewriting every line swaps their voice for a uniform one, and that
uniformity is what reads as generated.

- **`summary`**: two or three plain sentences about what they actually work on and their strongest
  specifics. Don't open with "<Title> with N years of experience" or "Results-driven <title>".
  Cut anything true of every candidate ("strong communicator").
- **`basics.headline`**: a role title people search for, not a slogan.
- **Bullets**: past tense for past roles; a concrete verb, then what was built or changed. Replace
  "Responsible for", "Worked on" and "Helped with" with what the person did. Lead with the result
  when there is one, but don't force every bullet into "Verb X, resulting in Y%". Vary the opening
  verbs. Cut a phrase that repeats across entries.
- **Projects**: the same rules for `description` and `bullets`. Say what it is and does, without
  "a robust, scalable platform".
- **Skill groups**: consolidate. Past about five groups it reads as a keyword dump.
- **Order**: most relevant experience and projects first.

Avoid the phrases the server rejects in tailored resumes (the list in `../tailor-resume/SKILL.md`,
"Summary"): an accepted rewrite becomes the base every tailored variant starts from.

Then run the `humanizer` skill in embedded mode on the summary, headline, bullets and project
descriptions you changed.

## Rules

The user sees a diff and clicks accept, so the diff is the guard:

1. Change wording, order, emphasis and grouping, never facts. No employer, date, title, degree,
   school or number that isn't in the extracted content or the PDF. Not a rounded metric, not an
   inferred date, not a "Senior" added to a title.
2. `changeNotes` lists every change, one per line, specific enough to check (`Summary: rewritten
   to lead with the HIPAA platform`). If you can't list a change, don't make it.
3. Keep every entry. Dropping or merging roles is `tailor-resume`'s job.
4. Don't touch `basics` contact fields: at onboarding the resume fills the profile.
5. If the resume is already good, save nothing and say so. A rejected suggestion teaches the user
   to ignore the next one.

## Save

`label` must be exactly `Suggested rewrite`: the dashboard finds it by that label and cleanup
skips it. `content` is the full resume, same shape `extract-resume` saves, every field carried
over. Write `{"label":"Suggested rewrite","content":<content>,"changeNotes":"<notes>"}` to
`$JOBPILOT_TEMP/suggested-rewrite.json`, then:

```bash
jobpilot-api POST /api/resumes/$RESUME_ID/variants --data @"$JOBPILOT_TEMP/suggested-rewrite.json"
```

A `400` means the content doesn't match the schema; fix it and send again. Then say:

> Suggested a rewrite of <label>: <one-line summary>. Review it at $JOBPILOT_WEB/resumes/$RESUME_ID

Don't open the browser or wait for an answer.

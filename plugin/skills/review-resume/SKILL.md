---
name: review-resume
description: Review a freshly uploaded resume and save a stronger rewritten version as a suggestion the user accepts or discards in the dashboard.
argument-hint: "<resumeId>"
---

# Review Resume

Save one improved version of a base resume as a `Suggested rewrite` variant. The user accepts or discards it in the dashboard. **Never write to the base resume.**

Runs after `extract-resume` on upload: extraction is faithful to the PDF, this pass makes the document better.

## Setup

Follow `../_shared/setup.md`, then:

```bash
jobpilot-api GET /api/resumes/$RESUME_ID
```

`content: null` → extraction hasn't run; say so and stop. Also `Read` the source PDF (path per `../_shared/setup.md`) - extraction flattens two-column layouts and drops emphasis.

## What to improve

For a human screener skimming, and the ATS parsing. Change only what's weak: where the candidate's own wording already works, keep it. Rewriting every line replaces their voice with one uniform voice, and that uniformity is what reads as generated.

- **`summary`** - two or three plain sentences about what they actually work on and their strongest specifics. Don't open with "<Title> with N years of experience" or "Results-driven <title>"; start from the work itself. Cut anything true of every candidate ("strong communicator", "team player").
- **`basics.headline`** - a role title people search for, not a slogan.
- **Bullets** - past tense for past roles; a concrete verb, then what was built or changed. Replace "Responsible for" / "Worked on" / "Helped with" with what the person did. Lead with the result when there is one, but don't force every bullet into "Verb X, resulting in Y%": a resume where every line has the same shape reads as generated. Don't start most bullets with the same verb ("Developed", "Built"). Cut a phrase that repeats across entries - one stock phrase in three roles flattens all three.
- **Projects** - the same rules for `description` and `bullets`: say what it is and what it does, without "a robust, scalable platform".
- **Skill groups** - consolidate. Past ~5 groups it reads as a keyword dump.
- **Ordering** - most relevant experience and projects first.

Avoid the phrases the server rejects in tailored resumes (listed in `../tailor-resume/SKILL.md`, "Summary"): if the user accepts this rewrite, it becomes the base every tailored variant starts from.

Then run the `humanizer` skill in **embedded mode** on the summary, headline, bullets, and project descriptions you changed.

## Rules

The user sees a diff and clicks accept, so the diff is the guard - not a server check:

1. **Wording, ordering, emphasis, grouping. Never facts.** No employer, date, title, degree, school, or number absent from the extracted content or the source PDF. Not a rounded metric, not an inferred date, not a "Senior" added to a title.
2. **`changeNotes` lists every change**, one per line, specific enough to check: `Summary: rewritten to lead with the HIPAA platform`. A change not in the notes is one the user can't decline - if you can't list it, don't make it.
3. **Keep every entry.** Dropping or merging roles is `tailor-resume`, which has server-side guards.
4. **Don't touch `basics` contact fields.** At onboarding the resume fills the profile, so it's the source of truth.
5. If the resume is already good, save nothing and say so. A suggestion the user rejects teaches them to ignore the next one.

## Save

`label` must be exactly `Suggested rewrite` - the dashboard finds it by that label and the retention sweep skips it. Write `{"label":"Suggested rewrite","content":<improved content>,"changeNotes":"<diff notes>"}` to `$JOBPILOT_TEMP/suggested-rewrite.json`, then:

```bash
jobpilot-api POST /api/resumes/$RESUME_ID/variants --data @"$JOBPILOT_TEMP/suggested-rewrite.json"
```

`content` is the full `ResumeData` - same shape `extract-resume` saves, every field carried over. A 400 means it doesn't match the schema; fix and resend.

Then:

> Suggested a rewrite of {label}: {one-line summary}.
> Review and accept at $JOBPILOT_WEB/resumes/$RESUME_ID

Don't open the browser or wait for an answer - the cycle ends here.

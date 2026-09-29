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
curl -sS --fail-with-body -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/resumes/$RESUME_ID"
```

`content: null` → extraction hasn't run; say so and stop. Also `Read` the source PDF (path per `../_shared/setup.md`) - extraction flattens two-column layouts and drops emphasis.

## What to improve

For a human screener skimming, and the ATS parsing:

- **`summary`** - what they do, at what level, two strongest specifics. Cut anything true of every candidate.
- **`basics.headline`** - a role title people search for, not a slogan.
- **Bullets** - outcome first, consistent tense, no "Responsible for" / "Worked on" / "Helped with". Remove phrasing repeated across entries - one stock phrase in three roles flattens all three.
- **Skill groups** - consolidate. Past ~5 groups it reads as a keyword dump.
- **Ordering** - most relevant experience and projects first.

Then run the `humanizer` skill in **embedded mode** on the summary and bullets.

## Rules

The user sees a diff and clicks accept, so the diff is the guard - not a server check:

1. **Wording, ordering, emphasis, grouping. Never facts.** No employer, date, title, degree, school, or number absent from the extracted content or the source PDF. Not a rounded metric, not an inferred date, not a "Senior" added to a title.
2. **`diffNotes` lists every change**, one per line, specific enough to check: `Summary: rewritten to lead with the HIPAA platform`. A change not in the notes is one the user can't decline - if you can't list it, don't make it.
3. **Keep every entry.** Dropping or merging roles is `tailor-resume`, which has server-side guards.
4. **Don't touch `basics` contact fields.** At onboarding the resume fills the profile, so it's the source of truth.
5. If the resume is already good, save nothing and say so. A suggestion the user rejects teaches them to ignore the next one.

## Save

`label` must be exactly `Suggested rewrite` - the dashboard finds it by that label and the retention sweep skips it.

```bash
curl -sS --fail-with-body -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/resumes/$RESUME_ID/variants" \
  -H 'content-type: application/json' \
  -d "$(jq -n --argjson content "$IMPROVED_CONTENT" --arg notes "$DIFF_NOTES" \
    '{label:"Suggested rewrite", content:$content, diffNotes:$notes}')"
```

`content` is the full `ResumeData` - same shape `extract-resume` saves, every field carried over. A 400 means it doesn't match the schema; fix and resend.

Then:

> Suggested a rewrite of {label}: {one-line summary}.
> Review and accept at $JOBPILOT_WEB/resumes/$RESUME_ID

Don't open the browser or wait for an answer - the cycle ends here.

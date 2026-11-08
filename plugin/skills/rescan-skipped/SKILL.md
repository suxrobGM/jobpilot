---
name: rescan-skipped
description: Re-score a feed's skipped jobs and promote the eligible ones to approved for later applying. Recovers jobs wrongly dropped for location, a sparse posting, 1099, or seniority. Does not apply.
argument-hint: "<feed-id> [--jobs key1,key2,...]"
---

# Rescan skipped

Re-score a feed's `skipped` jobs and move the eligible ones to `approved`. Never apply and never
change the feed's status.

## Setup

Follow `../_shared/setup.md`. `GET /api/feeds/<feed-id>`. `THRESHOLD` is the feed's
`config.minScore`, else `GET /api/pilot` `config.minScore`.

## 1. Targets

Every `skipped` job, or only the `--jobs` keys. Leave these alone:

- Always: `skipReason` starting `Already applied`, `CAPTCHA`, `Payment required` or `No visa
  sponsorship (JD:`, or one citing a stated citizenship or clearance requirement.
- Whole-feed runs (no `--jobs`) also leave the user's own choices: `Removed by user`, `Not
  selected by user`, `User cancelled...`, `Max applications limit reached`, `Feed paused by user`.

Low-score, zero-score and reason-less jobs are all targets: their stored score came from the run
that wrongly skipped them. Count the targets first and process every one.

## 2. Each job

1. **Brief**: parse the stored `brief`. Rich means non-empty `skills` and `requirements` or
   `responsibilities`.
2. **Read again** when the brief is thin or the old reason was invalid (location, sparse posting,
   1099, seniority): open the posting (narrowed snapshot; sign in per `../_shared/auth.md` if
   walled) and rebuild the brief.
3. **Score**: always a fresh `POST /api/fit-scores` `{brief, minScore:<THRESHOLD>}`. `verdict`
   `trust`: use `score`; `deliberate`: reason from `strongMatches`, `partialMatches` and `gaps`.
   Eligibility follows `../_shared/eligibility.md`; a low score alone (common at defense
   employers) is not a disqualifier.
4. **Decide** and write `$JOBPILOT_TEMP/rescan-<key>.json`:
   - Eligible and `score >= THRESHOLD`: `{"decision":"approved","matchScore":<n>,"matchReason":"<one
     line>","brief":"<brief JSON string>","description":"<posting text or empty>"}`.
   - Below threshold after a fair read: `decision:"skipped"`, the new score and reason, and
     `skipReason:"Below minimum match score (<score> < <THRESHOLD>)"`.
   - A stated citizenship, clearance or no-sponsorship bar found on rereading: `decision:"skipped"`
     with that reason.

   ```bash
   jobpilot-api POST /api/feeds/<feed-id>/jobs/<key>/rescan --data @"$JOBPILOT_TEMP/rescan-<key>.json"
   ```

## 3. Finish

Promoted + left skipped + left alone must equal the target count; keep going until it does. Print
a short table of promoted and still-skipped jobs with reasons, plus the tally ("228 skipped, 226
targets: 19 promoted, 207 left skipped"). Point the user to `$JOBPILOT_WEB/pipeline?feed=<feed-id>`
to apply the promoted jobs.

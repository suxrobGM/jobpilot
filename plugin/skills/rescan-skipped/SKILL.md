---
name: rescan-skipped
description: Re-score a feed's skipped jobs and promote the eligible ones to `approved` for later applying. Recovers jobs wrongly dropped for location, a sparse JD, 1099, or seniority. Does not apply.
argument-hint: "<feed-id> [--jobs key1,key2,…]"
---

# Rescan Skipped - Recover Wrongly-Dropped Jobs

Re-score a feed's `skipped` jobs and set eligible ones to `approved`. **Never apply and never
change the feed's status** - apply the promoted jobs afterward via the `apply` skill (`apply
feed <feed-id>`) or the feed page.

## Setup

Follow `../_shared/setup.md`. Fetch the feed: `jobpilot-api GET /api/feeds/<feed-id>`.
Threshold = the feed's `config.minScore`, else `GET /api/pilot` → `config.minScore`, else 60.

## Step 1: Select Targets

Targets are **every** `status:"skipped"` job; with `--jobs key1,key2,…`, restrict to those `key`s.

- **Always leave (permanent) - only these:** `skipReason` starting `Already applied`, `CAPTCHA`,
  `Payment required`, or `No visa sponsorship (JD:`, or one stating a JD-cited citizenship/clearance
  requirement.
- **Whole-feed mode (no `--jobs`):** also leave deliberate user choices - `Removed by user`,
  `Not selected by user`, `User cancelled…`, `Max applications limit reached`, `Feed paused by
  user`.
- **`--jobs` mode:** reconsider every named target except the permanent ones.

Count the full target list up front and process every one. **Below-threshold, zero-score, and
no-`skipReason` jobs are all targets** - the stored score came from the feed that wrongly
skipped them, so it's never a reason to skip the re-score. Don't cherry-pick the jobs already
at/above threshold.

## Step 2: Per Job

1. **Brief** - parse the cached `brief`. Rich = non-empty `skills` **and**
   `requirements`/`responsibilities`.
2. **Re-read only when needed** - if the brief is thin/empty, or the original `skipReason` was
   invalid (location/onsite, sparse JD, 1099, seniority), open the posting (`browser_navigate` +
   narrowed `browser_snapshot`; log in via `../_shared/auth.md` if walled) and rebuild the brief.
   Send that brief and posting text with the rescan command below; terminal rows cannot be PATCHed.

3. **Re-score** - every target gets a fresh `POST /api/fit-scores` with `{brief,
   minScore:<threshold>}`; never reuse the stored `matchScore`. Take the returned `score` as-is when
   `verdict` is `trust`; on `deliberate`, reason from `strongMatches`/`partialMatches`/`gaps`. A
   zero/low score with no `skipReason` (common at defense/federal employers) is not a disqualifier;
   eligibility follows `../_shared/eligibility.md`.
4. **Decide:**
   - Eligible and `score >= threshold` → promote (no apply). Write
     `{"decision":"approved","matchScore":<0-100>,"matchReason":"<one line>","brief":"<brief JSON
     string>","description":"<posting text or empty>"}` to `$JOBPILOT_TEMP/rescan-<key>.json`, then:

```bash
jobpilot-api POST /api/feeds/<feed-id>/jobs/<key>/rescan --data @"$JOBPILOT_TEMP/rescan-<key>.json"
```

- Below threshold after a fair read → POST `/rescan` with `decision:"skipped"`, the new
  score/reason, and `skipReason:"Below minimum match score (X < Y)"`.
- JD-stated citizenship/clearance or no-sponsorship language found on re-read → POST `/rescan` with
  `decision:"skipped"` and that eligibility reason.

## Step 3: Finish

Process every target before finishing - `promoted + left-skipped + permanent` must equal the target
count. If any are unprocessed, keep going; don't report a partial pass as complete.

Print a short table (promoted vs left `skipped`, with reasons) plus the reconciliation (e.g. "228
skipped → 226 targets; 19 promoted, 207 left skipped"). Then point the user to `apply feed
<feed-id>` (or the feed page's Apply selected). Don't apply; don't change feed status.

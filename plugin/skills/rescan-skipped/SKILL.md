---
name: rescan-skipped
description: Re-score a campaign's skipped jobs and promote the eligible ones to `approved` for later applying. Recovers jobs wrongly dropped for location, a sparse JD, 1099, or seniority. Does not apply.
argument-hint: "<campaign-id> [--jobs key1,key2,…]"
---

# Rescan Skipped - Recover Wrongly-Dropped Jobs

Re-score a campaign's `skipped` jobs and set eligible ones to `approved`. **Never apply and never change the campaign's status** - apply the promoted jobs afterward via the `apply` skill (`apply campaign <campaign-id>`) or the campaign page.

## Setup

```bash
JOBPILOT_API="${JOBPILOT_API:-https://jobpilot.suxrobgm.net}"
```

Follow `../../shared/setup.md`. Fetch the campaign: `curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/campaigns/<campaign-id>"`. Threshold = `config.minScore` (fallback `autoApply.minMatchScore`, else 60).

## Step 1: Select Targets

Targets are **every** `status:"skipped"` job; with `--jobs key1,key2,…`, restrict to those `key`s.

- **Always leave (permanent) - only these:** `skipReason` starting `Already applied`, `CAPTCHA`, `Payment required`, or `No visa sponsorship (JD:`, or one stating a JD-cited citizenship/clearance requirement.
- **Whole-campaign mode (no `--jobs`):** also leave deliberate user choices - `Removed by user`, `Not selected by user`, `User cancelled…`, `Max applications limit reached`, `Campaign paused by user`.
- **`--jobs` mode:** reconsider every named target except the permanent ones.

Count the full target list up front and process every one. **Below-threshold, zero-score, and no-`skipReason` jobs are all targets** - the stored score came from the campaign that wrongly skipped them, so it's never a reason to skip the re-score. Don't cherry-pick the jobs already at/above threshold.

## Step 2: Per Job

1. **Digest** - parse the cached `digest`. Rich = non-empty `techStack` **and** `requirements`/`responsibilities`.
2. **Re-read only when needed** - if the digest is thin/empty, or the original `skipReason` was invalid (location/onsite, sparse JD, 1099, seniority), open the posting (`browser_navigate` + narrowed `browser_snapshot`; log in via `../../shared/auth.md` if walled) and rebuild the digest. Send that digest and posting text with the rescan command below; terminal rows cannot be PATCHed.

3. **Re-score** - every target gets a fresh `POST /api/score-fit` with `{digest}`; never reuse the stored `matchScore`. If `confidence >= 0.7` and `score` is ≥10 from the threshold, trust it; else deliberate from `strongMatches`/`partialMatches`/`gaps`. A zero/low score with no `skipReason` (common at defense/federal employers) is not a disqualifier - only a JD-stated citizenship/clearance or no-sponsorship bar is (never infer from industry).
4. **Decide:**
   - Eligible and `score >= threshold` → promote (no apply):

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/<campaign-id>/jobs/<key>/rescan" \
  -H 'content-type: application/json' \
  -d "$(jq -n --argjson score <0-100> --arg reason "<one line>" --arg digest "$DIGEST" --arg desc "<posting text or empty>" \
    '{decision:"approved", matchScore:$score, matchReason:$reason, digest:$digest, description:$desc}')"
```

- Below threshold after a fair read → POST `/rescan` with `decision:"skipped"`, the new score/reason, and `skipReason:"Below minimum match score (X < Y)"`.
- JD-stated citizenship/clearance or no-sponsorship language found on re-read → POST `/rescan` with `decision:"skipped"` and that eligibility reason.

## Step 3: Eligibility

Follow `../../shared/eligibility.md` - seniority/below-level, location/onsite, sparse JDs, and 1099/contractor are never skips; only a JD-stated citizenship/clearance requirement - or, when the profile requires sponsorship, JD-stated no-sponsorship language - disqualifies.

## Step 4: Finish

Process every target before finishing - `promoted + left-skipped + permanent` must equal the target count. If any are unprocessed, keep going; don't report a partial pass as complete.

Print a short table (promoted vs left `skipped`, with reasons) plus the reconciliation (e.g. "228 skipped → 226 targets; 19 promoted, 207 left skipped"). Then point the user to `apply campaign <campaign-id>` (or the campaign page's Apply selected). Don't apply; don't change campaign status.

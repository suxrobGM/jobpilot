# Campaign Flow - Shared Mechanics and Rules

The blocks every campaign skill shares (`apply`, `auto-apply`, `resume-campaign`, `search`,
`upwork-search`, `networking`, and the pilot's campaign items). Load profile, resume, and
credentials per `./setup.md` first; each skill states only its deltas from what's here.

## Applied-check (dedupe before opening a tab)

```bash
URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
TITLE_ENCODED=$(jq -rn --arg v "<title>" '$v|@uri')
COMPANY_ENCODED=$(jq -rn --arg v "<company>" '$v|@uri')
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/applied/check?url=$URL_ENCODED&title=$TITLE_ENCODED&company=$COMPANY_ENCODED"
```

Exact URL match plus fuzzy title+company over a 30-day window; `.match.kind` is `url` or
`fuzzy` (with a score). Default handling for apply flows on `.applied`: create the Job as
`pending`, POST its `/result` with `{outcome:"skipped", skipReason:"Already applied (<kind>)"}`,
and move on without opening a tab. Skills that deviate (e.g. `networking` keeps applied jobs and
records `.match.application.id` as `relatedAppId`) say so inline.

## Terminal result writes

Non-terminal transitions go through `PATCH /api/campaigns/$CID/jobs/<key>`
(`pending` → `approved` → `applying`). A terminal outcome goes through ONE call -
`POST /api/campaigns/$CID/jobs/<key>/result` - which atomically updates the Job, creates the
Application + initial event on `applied`, and marks any queue entry. Payload shapes:

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# applied
jq -n --arg t "$NOW" --argjson score <0-100> '{outcome:"applied", appliedAt:$t, matchScore:$score}'
# failed (login failure, unexpected page, validation, crash)
jq -n --arg r "<failReason>" --arg notes "<retryNotes>" '{outcome:"failed", failReason:$r, retryNotes:$notes}'
# skipped (CAPTCHA, user cancelled, cap reached, ...)
jq -n --arg r "<skipReason>" '{outcome:"skipped", skipReason:$r}'
```

## job-worker apply-mode input

```json
{ "mode": "apply", "campaignId": "<CID>", "jobKey": "<key>", "url": "<job-url>",
  "board": "<domain>", "digest": <DIGEST>, "resumeId": "<RESUME_ID>",
  "defaultStartDate": "<autoApply.defaultStartDate>", "salaryExpectation": <remembered-or-null>,
  "preSubmitReview": <bool> }
```

Omit `digest` and the worker fetches it from the saved Job. The worker returns one of
`applied` / `failed` / `skipped` / `needs_user` and closes its tabs before returning -
re-select tab 0, then map the outcome to a terminal write (above). `needs_user` routing:

- `category:"salary"` (no profile salary preference matched) - ask the user once, remember the
  answer for the campaign, re-delegate with `salaryExpectation` set.
- `category:"verification"` (2FA) - pause and ask; one-time per board.
- `category:"payment"` - never pay: POST `/result` `{outcome:"failed", failReason:"Payment required"}`.

## Rules

1. **Never skip silently.** Every `skipped` write carries a non-empty `skipReason`. No valid
   reason → not a skip.
2. **The Campaign is the audit trail.** PATCH non-terminal transitions; POST `/result` for
   terminal outcomes, so SSE reflects reality.
3. **Never process payments** - record `failed` with `"Payment required"`.
4. **CAPTCHA is not a pause**: attempt the `solve-captcha` skill; unsolved → skip the job for a
   later manual apply. **2FA is**: pause and ask. Email codes: fetch via the `get-code` skill
   first (see `./auth.md`); only ask the user when it returns nothing.
5. **Account handling** per `./auth.md` - register when no account exists (without asking),
   forgot-password when the stored password is stale.
6. **Eligibility** per `./eligibility.md` - location/onsite, thin JDs, 1099/contract, and
   below-your-level are never skip reasons; only a JD-stated citizenship/clearance requirement
   (or, when sponsorship is needed, JD-stated no-sponsorship language) disqualifies.
7. **Pace** 3-5s between submissions on the same domain.
8. **Be honest about match scores** - label stretches as stretches.
9. **One worker at a time** - the browser is shared; never delegate the next job until the
   current worker returns.

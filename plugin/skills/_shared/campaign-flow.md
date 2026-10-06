# Campaign Flow - Shared Mechanics and Rules

The blocks every campaign skill shares (`apply`, `auto-apply`, `resume-campaign`, `search`,
`upwork-search`, `networking`, and the pilot's campaign items). Load profile, resume, and
credentials per `./setup.md` first; each skill states only its deltas from what's here.

## Applied-check (dedupe before opening a tab)

```bash
jobpilot-api GET /api/applied/check --query "url=<job-url>" --query "title=<title>" --query "company=<company>"
```

Exact URL match plus fuzzy title+company over a 30-day window; `.match.kind` is `url` or
`fuzzy` (with a score). Default handling for apply flows on `.applied`: create the Job as
`pending`, POST its `/result` with `{outcome:"skipped", skipReason:"Already applied (<kind>)"}`,
and move on without opening a tab. Skills that deviate (e.g. `networking` keeps applied jobs and
records `.match.application.id` as `relatedAppId`) say so inline.

The server enforces the same rule: moving a job into `applying` - the `PATCH` below or the pilot's
run start - 409s on a duplicate with a message opening `Already applied (<kind>)`. That is the
verdict, not a transient failure, and the server has already written the job's `skipped` result.
Move to the next item; never retry the transition or re-write the result.

## Terminal result writes

Non-terminal transitions go through `PATCH /api/campaigns/$CID/jobs/<key>` (`pending` → `approved` →
`applying`). A terminal outcome goes through ONE call - `POST
/api/campaigns/$CID/jobs/<key>/result` - which atomically updates the Job and creates the
Application + initial event on `applied`. Payload shapes (`appliedAt` is the current UTC time, ISO
8601):

```jsonc
// applied - resumeId/resumeVariantId name the resume that was uploaded (see below); omit either when empty
{ "outcome": "applied", "appliedAt": "<now>", "matchScore": <0-100>, "resumeId": "<resumeId>", "resumeVariantId": "<resumeVariantId>" }
// failed (login failure, unexpected page, validation, crash)
{ "outcome": "failed", "failReason": "<failReason>", "retryNotes": "<retryNotes>" }
// skipped (CAPTCHA, user cancelled, cap reached, ...)
{ "outcome": "skipped", "skipReason": "<skipReason>" }
```

**Always send `resumeId` on `applied`**, and `resumeVariantId` too whenever a tailored variant was
uploaded - including when `tailor-resume` reused an existing one. This is the only record of what
the candidate actually submitted; without it the application's Documents card has nothing to show.

## job-applier input

```json
{ "campaignId": "<CID>", "jobKey": "<key>", "url": "<job-url>",
  "board": "<domain>", "brief": <BRIEF>, "resumeId": "<RESUME_ID>",
  "salaryExpectation": <remembered-or-null>, "preSubmitReview": <bool> }
```

Omit `brief` and the worker fetches it from the saved Job; it loads the profile and saved answers
itself. It returns one of `applied` / `failed` / `skipped` / `needs_user` and closes its tabs before
returning - re-select tab 0, then map the outcome to a terminal write (above). `needs_user` routing:

- `category:"salary"` (no profile salary preference matched) - ask the user once, remember the
  answer for the campaign, re-delegate with `salaryExpectation` set.
- `category:"question"` (a required form question the profile can't answer) - ask the user
  `question`, re-delegate with the reply as `answers`. File the question with the worker's
  `answerKey` when it set one, so the answer is saved and never asked again.
- `category:"verification"` (2FA) - pause and ask; one-time per board.
- `category:"payment"` - never pay: POST `/result` `{outcome:"failed", failReason:"Payment
  required"}`.

## Rules

1. **Never skip silently.** Every `skipped` write carries a non-empty `skipReason`. No valid
   reason → not a skip.
2. **The Campaign is the audit trail.** PATCH non-terminal transitions; POST `/result` for
   terminal outcomes, so SSE reflects reality.
3. **Never process payments** - record `failed` with `"Payment required"`.
4. **CAPTCHA is not a pause**: attempt the `solve-captcha` skill; unsolved → skip the job for a
   later manual apply. **2FA is**: pause and ask. Logins, registration, and email codes follow
   `./auth.md`.
5. **Eligibility** follows `./eligibility.md`.
6. **Pace** 3-5s between submissions on the same domain.
7. **Be honest about match scores** - label stretches as stretches.
8. **One worker per browser** - a browser profile is shared by everything on its MCP server; never
   delegate the next job until the current worker returns, unless the pilot's `job.applyBatch`
   task gave each worker its own `browserServer`.

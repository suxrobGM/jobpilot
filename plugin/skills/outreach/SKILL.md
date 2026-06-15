---
name: outreach
description: Find a hiring manager/recruiter for a role (or company) and send a personalized message via cold email or LinkedIn, with per-campaign channels and autonomy.
argument-hint: "<target criteria> --campaign <campaign-id>"
---

# Outreach — Direct Hiring-Manager / Recruiter Contact

Discover a contact, draft a personalized message, and send it via **email** and/or
**LinkedIn** (Premium InMail or free connect-then-DM). Reaches people the ATS funnel hides.
Backed by a `Campaign` (`source: "outreach"`); each contacted person + message is tracked.

## Setup

Follow `../shared/setup.md` (health, profile, primary/tailored resume, credentials).

```bash
JOBPILOT_API="${JOBPILOT_API:-http://localhost:8002}"
```

- Email capability: `curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/email/account"` → if `data.canSend` is false,
  tell the user to **Reconnect Gmail** in email settings before email sends; LinkedIn still works.
- LinkedIn login: `../shared/auth.md`, credentials scope `"linkedin.com"`.

## Phase 0: Dispatch

`--campaign <id>` is required. Read the campaign config:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/campaigns/<campaign-id>" | jq '.config'
```

`config.outreach` = `{ channels:["email"|"linkedin"], linkedinTier:"free"|"premium",
autonomy:"draft"|"review"|"auto", dailyCap?, resumeUrl? }` (append `resumeUrl` verbatim to email body when present; never a `localhost` URL). `config` may also carry `board`
(domain to search) and optional `maxJobs` (cap; absent = run until stopped).

Target criteria = the positional arg, else `data.query`. The optional `board` is the control:
`board` set → search it (Phase 0.5) and loop results (Phase 1), grounding each message in its posting;
no `board` → discover from criteria, grounding only if an opening turns up. Skip contacts already
messaged on this campaign.

**Rewrite mode** (`--rewrite <id[,id...]>`): skip discovery; for each non-terminal message re-run
Phase 2 Compose and `PATCH .../outreach/<id>` the new `subject`/`body` (keep `status`). Don't
discover or send.

## Phase 0.5: Open the board (when `config.board` set)

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/job-boards" | jq --arg d "<config.board>" '.[] | select(.domain == $d)'
```

No row → PATCH campaign `failed`, `failReason:"Board <domain> not configured"`, stop. Else
`browser_navigate` to its `searchUrl` in **tab 1** (keep open), log in (`../shared/auth.md`), submit
the query, and `browser_snapshot` the results (narrowed, per `../shared/browser-tips.md`) for
`{ title, company, location, url }` per row.

## Phase 1: Discover + reach out

**Discover a contact** (multi-modal — never rely on LinkedIn's own search). For a company/role, sweep
in this order and cross-reference:

1. **Google → LinkedIn**: `WebSearch` `site:linkedin.com/in "<company>" ("recruiter" OR "talent"
   OR "hiring manager" OR "<title>")` — yields profile URLs without touching LinkedIn search.
2. **Company site**: careers/about/team pages for named recruiters or hiring contacts.
3. **General web**: press releases, GitHub (eng roles), meetup/conference pages.
4. **Email**: web-search the company's email pattern (`first.last@`, `flast@`, …), construct the
   address, MX-check the domain where possible. Set `emailSource:"guessed"` + a confidence.

Use `WebFetch` for pages; `browser_snapshot` (with `ref`, per `browser-tips.md`) only when a page
needs rendering. Pick the best match.

### With a board — loop over results

Walk tab-1 results top to bottom; per result:

1. Dedupe in-board, then applied-check:

   ```bash
   URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
   TITLE_ENCODED=$(jq -rn --arg v "<title>" '$v|@uri')
   COMPANY_ENCODED=$(jq -rn --arg v "<company>" '$v|@uri')
   curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/applied/check?url=$URL_ENCODED&title=$TITLE_ENCODED&company=$COMPANY_ENCODED"
   ```

   On `data.applied`, keep `data.match.application.id` as `relatedAppId` — **don't skip** (outreach
   complements applying).
2. Save the job (stable, shell-safe `key`):

   ```bash
   curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/<campaign-id>/jobs" \
     -H 'content-type: application/json' \
     -d "$(jq -n --arg key "<key>" --arg title "<title>" --arg company "<company>" \
       --arg location "<location>" --arg url "<job-url>" --arg board "<config.board>" \
       '{key:$key,title:$title,company:$company,location:$location,url:$url,board:$board,status:"pending"}')"
   ```
3. Discover + save the contact (below) with `relatedJobUrl` (+ `relatedAppId` if matched).
4. Compose (Phase 2), then gate (Phase 3).
5. Before the next result, `GET /api/campaigns/<campaign-id>`: `status:"paused"` → exit; `maxJobs`
   reached → stop; no rows left → scroll / next page, else Phase 5.

### Without a board — discover from criteria

Derive target companies/roles from the criteria and sweep each. Optionally ground a message in a
matching opening (`relatedJobUrl` + applied-check for `relatedAppId`); else reach out on criteria alone.

### Save a contact + message

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/<campaign-id>/outreach" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg name "<name>" --arg title "<title>" --arg company "<company>" \
    --arg li "<linkedin-url>" --arg email "<email-or-empty>" --arg src "google" \
    --arg chan "email" --arg jobUrl "<job-url-or-empty>" \
    '{contact:{name:$name,title:$title,company:$company,linkedinUrl:$li,
      email:(if $email=="" then null else $email end),emailSource:"guessed",discoverySource:$src,
      relatedJobUrl:(if $jobUrl=="" then null else $jobUrl end)},
      message:{channel:$chan,body:""}}')"
```

Add `relatedAppId:<id>` when applied-check matched. Keep the returned `data.id` (messageId) and
`data.contactId`. Create one message per channel.

## Phase 2: Compose

Per contact, invoke the `tailor-resume` skill for the role to surface the 1–2 matching proof
points — **this shapes the body even when no resume is sent**. Reuse the `humanizer` skill for
tone.

Sign as the user: name = `profile.{firstName, lastName}`, title = resume `content.basics.headline`
(profile has no `name`/`headline`; the API scopes to your account's single profile automatically).

**Style:** plain ASCII only (hyphens not em/en-dashes, straight quotes, no bullets — the terminal
mangles non-ASCII). Short and direct; run `humanizer`; no template tells.

Then per channel:

- **Email**: short subject + body, one specific proof point, soft ask. Per `resumeInclude`:
  `resumeUrl` present → append it verbatim (never a `localhost` URL); absent → no link.
- **LinkedIn connect note** (free tier, not yet connected): ≤300 chars, no link.
- **LinkedIn InMail** (premium) / **DM** (free, already connected): a few sentences.

Save the draft:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PATCH "$JOBPILOT_API/api/campaigns/<campaign-id>/outreach/<messageId>" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg s "<subject>" --arg b "<body>" --arg k "<linkedin-kind-or-empty>" \
    '{subject:(if $s=="" then null else $s end),body:$b,
      linkedinKind:(if $k=="" then null else $k end)}')"
```

(Set `linkedinKind` to `connect_note` | `inmail` | `dm` for LinkedIn messages.)

## Phase 3: Approval gate (by `autonomy`)

In the board loop this runs per contact as drafted; for criteria-only, once over the drafted set.

- **draft** → stop after drafting. Tell the user to review and send from
  `http://localhost:8000/campaigns/<campaign-id>`.
- **review** → present a table (contact, channel, subject/preview); user approves which to send.
  PATCH approved messages `{"status":"approved"}`, then proceed for those only.
- **auto** → send within `dailyCap`. **Email only**; LinkedIn connect requests pace at a low cap;
  **never auto-send InMail**.

## Phase 4: Send loop (pace 3–5s; respect `dailyCap`)

For each message to send:

- **Email** — send (carry `threadId` on follow-ups for threading):
  ```bash
  SENT=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/email/send" \
    -H 'content-type: application/json' \
    -d "$(jq -n --arg to "<email>" --arg s "<subject>" --arg b "<body>" \
      '{to:$to,subject:$s,body:$b}')")
  PID=$(echo "$SENT" | jq -r '.providerId'); TID=$(echo "$SENT" | jq -r '.threadId')
  curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/<campaign-id>/outreach/<messageId>/result" \
    -H 'content-type: application/json' \
    -d "$(jq -n --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg p "$PID" --arg th "$TID" \
      '{outcome:"sent",sentAt:$t,providerId:$p,threadId:$th}')"
  ```
- **LinkedIn Premium** — navigate to the profile, open Message (InMail), type, send. POST
  `/result` `{outcome:"sent",sentAt}`.
- **LinkedIn free** — not connected: click Connect, add the note if offered, send; then mark the
  parent contact pending and the message sent:
  `PATCH .../outreach/<messageId> {"contactLinkedinConnection":"pending"}` then POST `/result`
  `sent`. Already connected: send the DM. On a re-run, re-check `pending` contacts — when
  messaging is available, set `"connected"` and send the queued DM.

Failures → POST `/result` `{outcome:"failed",failReason:"<why>"}`. A guessed email that bounces
will surface later via inbox sync.

## Phase 5: Summary

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PATCH "$JOBPILOT_API/api/campaigns/<campaign-id>" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{status:"completed",completedAt:$t}')"
```

Print a table (contact, channel, status) and link to `http://localhost:8000/campaigns/<campaign-id>`.

## Rules

1. **Human-in-loop per `autonomy`** — never auto-send InMail; keep LinkedIn volume low with
   randomized pacing (protects the user's own account from ToS bans).
2. **No attachment on a cold first touch** — resume goes out as a link only.
3. **Dedupe** — skip contacts already messaged for the same role.
4. **CAPTCHA / 2FA** during LinkedIn login → for a CAPTCHA, invoke the `solve-captcha` skill; if unsolved (or for 2FA), pause and ask (`../shared/auth.md`).
5. **Personalize** — one specific, real detail per message; no generic templates.
6. **The Campaign is the audit trail** — PATCH non-terminal edits; POST `/result` for terminal outcomes.

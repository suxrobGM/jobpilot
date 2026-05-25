---
name: get-code
description: Fetch the latest verification code or magic link from the connected mailbox for a given board domain. Called by apply / auto-apply for 2FA and account-creation flows.
argument-hint: "<board-domain>"
---

# Get Verification Code

Return the most recent verification code (or magic link) for a given board domain. Output is a single JSON object on stdout — the caller parses it and fills the form. Argument is the board domain (`linkedin.com`, `workday.com`, etc.).

## Setup

Read `plugin/skills/shared/setup.md` to load `JOBPILOT_API`.

```bash
JOBPILOT_API=http://localhost:8000
BOARD_DOMAIN="$1"
```

## Phase 1: Confirm Mailbox Connected

```bash
curl -fsS "$JOBPILOT_API/api/email/account"
```

If `data.connected === false`, print exactly `{}` and exit. Caller falls back to asking the user.

## Phase 2: Trigger Sync

```bash
curl -fsS -X POST "$JOBPILOT_API/api/email/sync"
```

## Phase 3: Poll for the Code

Up to 6 attempts (~30s) looking for a verification message in the last 5 minutes:

```bash
for i in 1 2 3 4 5 6; do
  RESULT=$(curl -fsS -G "$JOBPILOT_API/api/email/messages" \
    --data-urlencode "classification=verification" \
    --data-urlencode "domainHint=$BOARD_DOMAIN" \
    --data-urlencode "since=$(date -u -d '5 minutes ago' +%FT%TZ 2>/dev/null || date -u -v-5M +%FT%TZ)")
  COUNT=$(echo "$RESULT" | jq '.data | length')
  if [ "$COUNT" -gt 0 ]; then break; fi
  sleep 5
done
```

If still nothing, also look for unclassified messages whose body matches the board domain (Gmail may have arrived but `scan-inbox` hasn't classified it yet). Classify inline:

1. Read `data[0]` (most recent first).
2. Inspect `subject`, `fromAddress`, `snippet`, `rawBody`.
3. If it's not a real verification for `$BOARD_DOMAIN`, print `{}` and exit.
4. Extract:
   - **`verificationCode`** — 4–8 digit alphanumeric. Patterns: `\b\d{4,8}\b`, `code is (\S+)`, `verification code:\s*(\S+)`.
   - **`verificationLink`** — "click to verify" URL. Anchors containing "verify", "confirm", "magic link", or links to the board's own domain.
5. PATCH the message:

   ```bash
   curl -fsS -X PATCH "$JOBPILOT_API/api/email/messages/<id>" \
     -H 'content-type: application/json' \
     -d "$(jq -n --arg code "<code>" --arg link "<link>" --arg domain "$BOARD_DOMAIN" \
       '{classification:"verification",
         confidence:1,
         verificationCode:($code|select(length>0)),
         verificationLink:($link|select(length>0)),
         verificationDomain:$domain,
         reasoning:"Extracted by get-code"}')"
   ```

## Phase 4: Return

Print exactly one JSON object to stdout:

```json
{ "code": "123456", "link": "https://..." }
```

Either field may be missing if the email had only one. Print `{}` if no usable value was found.

The calling skill reads stdout, fills the verification field with `code` or opens `link`, then continues.

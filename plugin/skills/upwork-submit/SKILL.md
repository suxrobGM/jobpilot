---
name: upwork-submit
description: Submit an approved JobPilot proposal draft to Upwork through the Upwork MCP, after showing the user the Connects cost and getting an explicit yes.
argument-hint: "<proposal_id>"
---

# Upwork submit

Submit a proposal the user already reviewed. It spends the user's Connects: never submit without
showing the cost and getting an explicit yes in this conversation.

## Setup

Follow `../_shared/setup.md` and `../_shared/upwork-mcp.md` (connection check, `org_uid`).

## 1. Load the draft

`GET /api/upwork/proposals/<id>`. Its `status` must be `draft` (a `submitted` one must never go
twice); otherwise say what it is and stop. Empty `proposalText` or no `jobUrl`: tell the user to
draft it with the `upwork-proposal` skill first, and stop.

## 2. Check for an invitation or proposal

Always. Upwork rejects a `create` on a job with an invitation or proposal (`VJ-JA-10`).

- `list_freelancer_proposals` `list` has one for this job: stop and tell the user.
- `list_freelancer_proposals` `invitations` has one: use `manage_proposals` `accept_invitation`
  with its `id` instead of `create`, confirm type `proposal_accept_invitation`.

## 3. Preview

`manage_proposals` `create`:

- `job_reference`: the numeric job id, not the `~02...` ciphertext. Resolve it from `jobUrl` with
  `find_jobs` `get` when needed.
- `cover_letter`: `proposalText`, max 5000 characters. Longer: ask the user to shorten it; never
  truncate their words.
- `charged_amount`: the bid, a number. From the stored proposal or the user, never invented.
- `answers`: `screeningAnswers`. A screening question they don't cover: ask the user.

This returns a preview; nothing is submitted yet.

## 4. Confirm

Show:

- `connects_cost` and `connects_balance`, always;
- `unmet_preferred_qualifications`, when present (advisory);
- boost, unless `boost.available` is false or `boost.recommendation` is `skip`. Boosting is a
  Connects bid for a top slot: show `boost.current_top_bids` and `boost.recommended_connects` (the
  smallest bid that wins a slot) and let the user pick, at most `boost.max_boost_connects`, passed
  as `boost_connects`. Never boost by default.

Offer attachments and highlights (`get_profile` `list_highlights`). Then ask for an explicit yes;
silence or a vague reply is a no.

## 5. Submit

`confirm_preview` type `proposal` with the `preview_id`. On success:

```bash
jobpilot-api PATCH /api/upwork/proposals/<id> --data '{"status":"submitted","submittedAt":"<now, ISO 8601 UTC>"}'
jobpilot-api PUT /api/upwork/account --data '{"connectsBalance": <balance>}'
```

Read the new balance from `get_profile` `connects_balance`, not by subtracting. With a boost,
report the stored bid from `list_freelancer_proposals` `get` (`terms.connectsBid`); it can't be
changed here.

- Declined: leave it a draft, say nothing was sent or spent, and stop. Don't start a second
  preview; it would replace the pending one.
- Upwork error: leave it a draft and report the error verbatim, including any purchase URL for
  missing Connects.

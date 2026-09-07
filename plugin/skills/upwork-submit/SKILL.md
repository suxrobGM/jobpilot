---
name: upwork-submit
description: Submit an approved JobPilot proposal draft to Upwork through the Upwork MCP, after showing the user the Connects cost and getting an explicit yes.
argument-hint: "<proposal_id>"
---

# Submit an Upwork Proposal

Take a proposal the user already reviewed in JobPilot and submit it to Upwork. **This spends the
user's Connects.** Never submit without showing the cost and getting an explicit yes in this
conversation.

## Setup

1. Follow `../_shared/setup.md`.
2. Follow `../_shared/upwork-mcp.md`: confirm the tools are connected and resolve `ORG_UID`.

## Step 1: Load the draft

```bash
PROPOSAL=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/upwork/proposals/$ARG")
```

Require `.status == "draft"`. Anything else → stop and say what the status is; a `submitted`
proposal must not be sent twice.

Require a non-empty `.proposalText` and a `.jobUrl`. Missing either → tell the user to draft it
first with the `upwork-proposal` skill, then stop.

## Step 2: Check for an existing invitation or proposal

**Mandatory. Never skip.** Upwork rejects a `create` on a job the user was invited to or already
applied to, with error `VJ-JA-10`, and the turn is wasted.

1. `list_freelancer_proposals` action `invitations` - is there an invitation for this job?
2. `list_freelancer_proposals` action `list` - is there already a proposal for it?

An existing proposal → stop and tell the user; do not submit again. An invitation → use
`manage_proposals` action `accept_invitation` with the invitation's `id` instead of `create`, and
confirm with type `proposal_accept_invitation`.

## Step 3: Build the preview

`manage_proposals` action `create` with:

- `job_reference` - the **numeric** job id, not the `~02…` ciphertext. Resolve it from the
  proposal's `jobUrl` via `find_jobs` action `get` if the id is not already in the digest.
- `cover_letter` - the proposal's `proposalText`. Max 5000 characters; if it is longer, stop and
  ask the user to shorten it rather than truncating their words.
- `charged_amount` - the bid, as a number.
- `answers` - the proposal's `screeningAnswers`. The preview lists the job's
  `screening_questions`; if it asks something the stored answers do not cover, stop and ask the
  user rather than inventing an answer.

This returns a preview. It does **not** submit.

## Step 4: Present and confirm

Show the user, always including the first two:

- `connects_cost` - what this application spends.
- `connects_balance` - what they have.
- `unmet_preferred_qualifications`, when present. Advisory only, it does not block submission.
- The `boost` block, unless `boost.available` is false or `boost.recommendation` is `skip`.
  Boosting is a Connects **bid** for a top slot, not a flat fee. Show
  `boost.current_top_bids` as the real competing bids and `boost.recommended_connects` as the
  smallest bid that takes a top slot. Let the user pick the number. Never exceed
  `boost.max_boost_connects`, and pass what they chose as `boost_connects`.

Ask whether they want to attach files or highlight portfolio projects and certificates
(`get_profile` action `list_highlights`). Both are optional but must be offered.

Then get an explicit yes. A silent or ambiguous reply is a no.

## Step 5: Submit and record

`confirm_preview` type `proposal` with the `preview_id`.

On success:

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PATCH "$JOBPILOT_API/api/upwork/proposals/$ARG" \
  -H 'content-type: application/json' -d "$(jq -n --arg t "$NOW" '{status:"submitted", submittedAt:$t}')"
```

Then refresh the Connects balance so the web app shows what is left:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PUT "$JOBPILOT_API/api/upwork/account" \
  -H 'content-type: application/json' -d '{"connectsBalance": <new balance>}'
```

Read the new balance from `get_profile` action `connects_balance`, not by subtracting.

If the user declines, leave the proposal as `draft`, say nothing was submitted and no Connects
were spent, and stop. Do not start a second preview: a new one silently replaces the pending one.

If Upwork returns an error, leave the proposal as `draft` and report the error text verbatim. An
insufficient-Connects error carries a purchase URL - pass it on.

## Rules

1. **Never submit without an explicit yes** in this conversation, naming the Connects cost.
2. **One submission per proposal.** Status must be `draft` going in.
3. **Never invent a screening answer or a bid.** Both come from the stored proposal or the user.
4. **Never boost by default.** It is a separate Connects spend and a separate decision.
5. A submitted boost cannot be edited or withdrawn here. Verify what Upwork stored with
   `list_freelancer_proposals` action `get` and report `terms.connectsBid` as the real figure.

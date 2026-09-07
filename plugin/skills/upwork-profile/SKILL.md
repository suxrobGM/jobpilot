---
name: upwork-profile
description: Read the user's live Upwork profile through the Upwork MCP, generate an improved title, overview, skills and portfolio from their resume (humanized), and - after the user approves - write the approved version back to Upwork.
argument-hint: "[apply]"
---

# Upwork Profile Enhancement

Two modes. Default (**generate**) drafts suggestions for review; **apply** (argument `apply`)
writes the approved version to the live Upwork profile. Always gate the live write behind the
user's approval - never edit the real profile from the generate step.

The MCP writes the title, overview and skills. It cannot write the portfolio or the hourly rate,
so those two are **advisory**: JobPilot generates and stores them, and the user copies them to
upwork.com. Say so plainly rather than implying they were applied.

## Setup

1. Follow `../_shared/setup.md` (`$JOBPILOT_API` is injected by the terminal). `Read` the resume
   at `primaryResumeSourceAbsolutePath` for identity, summary, experience, skills, and
   **projects** (the portfolio source).
2. Follow `../_shared/upwork-mcp.md`: confirm the tools are connected and resolve `ORG_UID`.

## Mode: generate (default)

1. **Read the current profile.** `get_profile` action `get` for the title, overview, skills, rate
   and work history. `get_profile` action `list_highlights` for the portfolio projects and
   certificates already on the account.
2. **Generate suggestions** grounded only in resume facts (no fabrication):
   - **Title** - concise, role plus top stack. Hard limit 70 characters.
   - **Overview** - lead with the client's outcome, then proof (real projects and metrics from the
     resume), then a clear CTA. Hard limit 5000 characters. Then invoke the `humanizer` skill on
     it in **embedded mode** to strip AI tells.
   - **Skills** - at most 20, and each must be a real Upwork ontology skill name. Unresolvable
     names are rejected at write time, so prefer the exact wording already on the profile or in
     the job market over invented labels.
   - **Portfolio** (advisory) - derive entries from resume `projects`:
     `{ title, description, url?, skills[] }`. Keep existing good ones; add or improve from the
     resume.
   - **Hourly rate** (advisory) - only suggest if the resume or profile gives a basis; otherwise
     leave the current value.
3. **Save the draft** for review:

   ```bash
   curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PUT "$JOBPILOT_API/api/upwork/profile" -H 'content-type: application/json' \
     -d "$(jq -n --arg ct "<current title>" --arg co "<current overview>" --arg st "<suggested title>" \
       --arg so "<suggested overview>" --argjson cp '<current portfolio json>' --argjson sp '<suggested portfolio json>' \
       --argjson cs '<current skills json>' --argjson ss '<suggested skills json>' \
       '{currentTitle:$ct, currentOverview:$co, currentPortfolio:$cp, currentSkills:$cs, suggestedTitle:$st, suggestedOverview:$so, suggestedPortfolio:$sp, suggestedSkills:$ss, status:"draft"}')"
   ```

4. Print a short before/after summary and link to `$JOBPILOT_WEB/upwork/profile` - tell the user to
   review, edit, **Approve**, then run **Apply to Upwork**. Stop here; do not write to Upwork.

## Mode: apply

1. `curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/upwork/profile"` →
   require `.status == "approved"`. If not, tell the user to review and approve on
   `/upwork/profile` first, then stop.
2. Use the `suggested*` fields as the source of truth (the user may have edited them in the UI).
3. Write each section, one at a time. Every one is a preview then a confirm
   (`../_shared/upwork-mcp.md`), so present each preview and get an explicit yes before
   confirming. Only one preview per action type is held at a time, so finish one section before
   starting the next.
   - `update_profile` action `update_title` → `confirm_preview` type `profile_update_title`.
   - `update_profile` action `update_overview` → `confirm_preview` type `profile_update_overview`.
   - `update_profile` action `set_skills` → `confirm_preview` type `profile_set_skills`. This
     **replaces** the whole set, so pass the full revised list, not just additions. Names are
     resolved against Upwork's ontology first; a partial draft lists which were rejected. Relay
     those to the user instead of guessing substitutes.
4. On success, mark it applied:

   ```bash
   curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PUT "$JOBPILOT_API/api/upwork/profile" -H 'content-type: application/json' \
     -d '{"status":"applied"}'
   ```

   Report what was written. Then tell the user the portfolio and hourly rate were **not** applied
   and are waiting for them on `$JOBPILOT_WEB/upwork/profile` to copy across. If a section fails
   to save, leave `status` unchanged, report which section, and stop.

## Rules

1. **Approval gate.** Only `apply` writes to Upwork, and only when `status == "approved"`.
2. **Never claim an advisory field was applied.** The portfolio and hourly rate are always manual.
3. **No fabrication.** Every claim traces to the resume; no invented metrics, links, or experience.
4. **Humanize the overview** via the `humanizer` skill in embedded mode - no
   "passionate/dedicated/leverage", no AI symmetry, no functional emoji bullets.

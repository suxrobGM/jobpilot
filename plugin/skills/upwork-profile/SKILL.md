---
name: upwork-profile
description: Read the user's live Upwork profile, generate an improved overview + portfolio from their resume (humanized), and - after the user approves - write the approved version back to Upwork.
argument-hint: "[apply]"
---

# Upwork Profile Enhancement

Two modes. Default (**generate**) drafts suggestions for review; **apply** (argument `apply`) writes the approved version to the live Upwork profile. Always gate the live write behind the user's approval - never edit the real profile from the generate step.

## Setup

Follow `../_shared/setup.md` (`$JOBPILOT_API` is injected by the terminal). `Read` the resume at `primaryResumeSourceAbsolutePath` for identity, summary, experience, skills, and **projects** (the portfolio source). Log in to Upwork via `../_shared/auth.md` (resolve via `/api/credentials/resolve?domain=upwork.com`).

## Mode: generate (default)

1. **Read the current profile.** `browser_navigate` to the user's Upwork profile, `browser_snapshot` (`../_shared/browser-tips.md`), and capture the current `title`, `overview`, `hourlyRate`, and `portfolio` projects.
2. **Generate suggestions** grounded only in resume facts (no fabrication):
   - **Title** - concise, role + top stack (e.g. "Senior React/Node Engineer - SaaS & APIs").
   - **Overview** - lead with the client's outcome, then proof (real projects/metrics from the resume), then a clear CTA. Then invoke the `humanizer` skill on it to strip AI tells.
   - **Portfolio** - derive entries from resume `projects`: `{ title, description, url?, skills[] }`. Keep existing good ones; add/improve from the resume.
   - **Hourly rate** - only suggest if the resume/profile gives a basis; otherwise leave the current value.
3. **Save the draft** for review:

   ```bash
   curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PUT "$JOBPILOT_API/api/upwork/profile" -H 'content-type: application/json' \
     -d "$(jq -n --arg ct "<current title>" --arg co "<current overview>" --arg st "<suggested title>" \
       --arg so "<suggested overview>" --argjson cp '<current portfolio json>' --argjson sp '<suggested portfolio json>' \
       '{currentTitle:$ct, currentOverview:$co, currentPortfolio:$cp, suggestedTitle:$st, suggestedOverview:$so, suggestedPortfolio:$sp, status:"draft"}')"
   ```

4. Print a short before/after summary and link to `$JOBPILOT_WEB/upwork/profile` - tell the user to review, edit, **Approve**, then run **Apply to Upwork**. Stop here; do not write to Upwork.

## Mode: apply

1. `curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/upwork/profile"` → require `.status == "approved"`. If not, tell the user to review and approve on `/upwork/profile` first, then stop.
2. Use the `suggested*` fields as the source of truth (the user may have edited them in the UI).
3. `browser_navigate` to the Upwork profile editor and write each section via `../_shared/form-filling.md`: title, overview, hourly rate (if suggested), and portfolio projects (add/update). `browser_wait_for` and re-snapshot after each save. Pause and ask the user on 2FA; attempt the `solve-captcha` skill on a CAPTCHA.
4. On success, mark it applied:

   ```bash
   curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PUT "$JOBPILOT_API/api/upwork/profile" -H 'content-type: application/json' \
     -d '{"status":"applied"}'
   ```

   Report what was written. If a section fails to save, leave `status` unchanged, report which section, and stop.

## Rules

1. **Approval gate.** Only `apply` writes to Upwork, and only when `status == "approved"`.
2. **No fabrication.** Every claim traces to the resume; no invented metrics, links, or experience.
3. **Humanize the overview** via the `humanizer` skill - no "passionate/dedicated/leverage", no AI symmetry, no functional emoji bullets.
4. **Account handling** - `../_shared/auth.md`.

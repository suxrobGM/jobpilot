---
name: upwork-profile
description: Read the user's live Upwork profile through the Upwork MCP, generate an improved title, overview, skills and portfolio from their resume (humanized), and - after the user approves - write the approved version back to Upwork.
argument-hint: "[apply]"
---

# Upwork profile

Two modes. Default drafts suggestions for review. `apply` writes the approved version to Upwork.
Never write to Upwork from the draft step.

The MCP can write the title, overview and skills. The portfolio and hourly rate are advisory:
JobPilot stores them and the user copies them to upwork.com. Say so; never imply they were
applied.

## Setup

Follow `../_shared/setup.md`, then `GET /api/resumes/<user.primaryResumeId>` (its `projects` feed
the portfolio). Follow `../_shared/upwork-mcp.md` (connection check, `org_uid`).

## Draft (default)

1. Read the profile: `get_profile` `get` (title, overview, skills, rate, history) and
   `list_highlights` (portfolio and certificates).
2. Write suggestions from resume facts only:
   - **Title**: role plus top stack, at most 70 characters.
   - **Overview**: to one client skimming. One sentence on what you do for clients, two or three
     real projects with a concrete result each, then how to start working together. Short
     paragraphs, first person, 1000-2000 characters. Keep lines from the current overview that
     already work.
   - **Skills**: at most 20, each an exact Upwork skill name; prefer the wording already on the
     profile. Unknown names are rejected on write.
   - **Portfolio**: `{ title, description, url?, skills[] }` from resume `projects`. Keep good
     existing entries. Each description says what the project is plus one concrete detail, and
     they don't all share one shape.
   - **Hourly rate**: only with a basis in the resume or profile; else keep the current one.

   Run the `humanizer` skill in embedded mode on the overview and portfolio descriptions.
3. Save the draft. Write `$JOBPILOT_TEMP/upwork-profile.json`:

   ```json
   { "currentTitle": "", "currentOverview": "", "currentPortfolio": [], "currentSkills": [],
     "suggestedTitle": "", "suggestedOverview": "", "suggestedPortfolio": [], "suggestedSkills": [],
     "status": "draft" }
   ```

   ```bash
   jobpilot-api PUT /api/upwork/profile --data @"$JOBPILOT_TEMP/upwork-profile.json"
   ```

4. Print a short before/after and `$JOBPILOT_WEB/upwork/profile`: the user reviews, edits,
   approves, then runs **Apply to Upwork**. Stop.

## Apply

1. `GET /api/upwork/profile`. `status` not `approved`: tell the user to approve it at
   `$JOBPILOT_WEB/upwork/profile` first, and stop.
2. Use the `suggested*` fields; the user may have edited them.
3. Write one section at a time; each is a preview, the user's explicit yes, then confirm:
   - `update_profile` `update_title`, confirm type `profile_update_title`;
   - `update_profile` `update_overview`, confirm type `profile_update_overview`;
   - `update_profile` `set_skills`, confirm type `profile_set_skills`. It replaces the whole set,
     so send the full list. Relay any rejected names to the user; don't guess substitutes.
4. All saved: `PUT /api/upwork/profile --data '{"status":"applied"}'`. Report what was written,
   and that the portfolio and rate wait at `$JOBPILOT_WEB/upwork/profile` to be copied by hand. A
   section that fails: leave `status` alone, report which, and stop.

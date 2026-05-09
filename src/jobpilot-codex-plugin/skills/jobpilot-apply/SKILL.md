---
name: jobpilot-apply
description: Auto-fill job application forms via Playwright. Accepts a URL or pasted job page, reviews qualification fit, handles login, and fills forms with resume data.
argument-hint: "<job_application_url_or_pasted_job_page>"
---
# JobPilot Codex Adapter

This Codex skill is a provider adapter. The reusable workflow lives in the
shared JobPilot skill pack.

Set these provider values for the shared workflow:

- JOBPILOT_SKILLS_ROOT is src/jobpilot-skills when running from the source repo, or jobpilot-skills next to this plugin in published output.
- JOBPILOT_WORKSPACE_ROOT is the current JobPilot repository/workspace root.
- <apply-command> = $jobpilot-apply
- <apply-batch-command> = $jobpilot-apply-batch
- <autopilot-command> = $jobpilot-autopilot
- <cover-letter-command> = $jobpilot-cover-letter
- <humanizer-command> = $jobpilot-humanizer

Read and follow ${JOBPILOT_SKILLS_ROOT}/skills/apply.md.
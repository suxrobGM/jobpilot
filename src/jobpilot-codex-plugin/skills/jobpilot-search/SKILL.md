---
name: jobpilot-search
description: Search job boards for matching positions using Playwright. Filters by qualification fit against the user's resume. Respects job board config from the JobPilot API.
argument-hint: "<job_title_keywords_location>"
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

Read and follow ${JOBPILOT_SKILLS_ROOT}/skills/search.md.
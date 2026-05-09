---
name: jobpilot-cover-letter
description: Generate a tailored cover letter from a job description using the user's resume. Applies humanizer for natural tone.
argument-hint: "<job_description>"
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

Read and follow ${JOBPILOT_SKILLS_ROOT}/skills/cover-letter.md.
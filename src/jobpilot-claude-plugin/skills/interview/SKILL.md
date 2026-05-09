---
name: interview
description: Generate interview prep Q&A tailored to a job description and the user's resume. Covers technical, behavioral, and system design questions.
argument-hint: "<job_description>"
---

# JobPilot Claude Adapter

This Claude Code skill is a provider adapter. The reusable workflow lives in
the shared JobPilot skill pack.

Set these provider values for the shared workflow:

- `JOBPILOT_SKILLS_ROOT=${CLAUDE_PLUGIN_ROOT}/../jobpilot-skills`
- `JOBPILOT_WORKSPACE_ROOT` is the current JobPilot repository/workspace root.
- `<apply-command>` = `/jobpilot:apply`
- `<apply-batch-command>` = `/jobpilot:apply-batch`
- `<autopilot-command>` = `/jobpilot:autopilot`
- `<cover-letter-command>` = `/jobpilot:cover-letter`
- `<humanizer-command>` = `/jobpilot:humanizer`

Read and follow `${JOBPILOT_SKILLS_ROOT}/skills/interview.md`.

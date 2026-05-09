---
name: apply-batch
description: Apply to a queued list of job URLs from the JobPilot batch input. Visits each, scores against your resume, presents a ranked batch for approval, then applies autonomously.
argument-hint: "(none - pulls pending URLs from /api/batch/pending)"
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

Read and follow `${JOBPILOT_SKILLS_ROOT}/skills/apply-batch.md`.

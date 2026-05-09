---
name: autopilot
description: Autonomously search job boards and apply to matching positions in batch. Tracks progress in the JobPilot database for resumability and live viewing. User approves a batch once, then Claude applies to all approved jobs without further prompts.
argument-hint: "<search_query OR 'resume' OR 'retry-failed <run-id>'>"
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

Read and follow `${JOBPILOT_SKILLS_ROOT}/skills/autopilot.md`.

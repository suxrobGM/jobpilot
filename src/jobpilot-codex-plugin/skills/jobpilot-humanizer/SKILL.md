---
name: jobpilot-humanizer
version: 2.3.0
description: |
  Remove signs of AI-generated writing from text. Use when editing or reviewing
  text to make it sound more natural and human-written. Based on Wikipedia's
  comprehensive "Signs of AI writing" guide. Detects and fixes patterns including:
  inflated symbolism, promotional language, superficial -ing analyses, vague
  attributions, em dash overuse, rule of three, AI vocabulary words, negative
  parallelisms, and excessive conjunctive phrases.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
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

Read and follow ${JOBPILOT_SKILLS_ROOT}/skills/humanizer.md.
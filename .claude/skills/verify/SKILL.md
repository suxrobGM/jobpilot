---
name: verify
description: Run the full JobPilot CI gate locally - Biome, knip, API + web typechecks, API and contracts tests, and the terminal .NET tests when terminal files changed. Use before committing, or when asked to "verify", "run checks", or "run the gate".
---

# Verify

Run from the repo root, in order. Stop at the first failure and report its output.

1. `bun run ci`
2. `bun run knip`
3. `bun --cwd=apps/api run typecheck`
4. `bun --cwd=apps/web run typecheck`
5. `bun --cwd=apps/api run test`
6. `bun --cwd=packages/contracts run test`
7. Only if the working tree or branch diff touches `apps/terminal/` or `tests/`
   (`git status --porcelain` + `git diff --name-only main...`):
   `dotnet test tests/JobPilot.Terminal.Tests`

Finish with a one-line pass/fail summary per step.

---
name: release
description: Bump the unified JobPilot version (host + plugin), update the changelog, commit, and tag a new release
user-invocable: true
---

# Release Skill

Cut a new JobPilot release. Host and plugin share **one version** and ship from
**one tag** (`vX.Y.Z`), which triggers `.github/workflows/release.yml` - it builds
the terminal binaries for all RIDs, publishes the GitHub Release (the terminal
archives, which bundle the plugin tree), and syncs the plugin tree into the
`claude-plugins` and `codex-plugins` marketplaces.

## Usage

The user provides a version (e.g. `2.1.0`) or a bump type (`major`, `minor`,
`patch`). With no argument, default to a `patch` bump.

## Context

- **Version source of truth (must stay in lockstep):**
  - `apps/terminal/JobPilot.Terminal.csproj` - the `<Version>` element
  - `plugin/.claude-plugin/plugin.json` - `"version"`
  - `plugin/.codex-plugin/plugin.json` - `"version"`
  - `package.json` - `"version"`
- **Tag format:** `vX.Y.Z` (matches the `v*` trigger in `release.yml`).
- **Changelog:** `CHANGELOG.md` at the repo root, [Keep a Changelog](https://keepachangelog.com)
  format, newest release first. The workflow also sets `generate_release_notes: true`
  for the GitHub Release.

## Steps

1. **Determine the new version:**
   - Read the current version from all four files above.
   - If they differ, report the mismatch and reconcile to the highest before bumping.
   - Use the user's explicit version, else compute from the bump type, else bump patch.
   - Verify the new version is strictly greater than the current highest.

2. **Pre-flight checks** (stop and report on any failure - do not paper over):
   - Working tree is clean (`git status`).
   - Current branch is `main` (or ask if on another branch).
   - No existing tag `vX.Y.Z` (`git tag -l`).

3. **Bump version:** set the new version in all four files.

4. **Update CHANGELOG.md** (create it with a `# Changelog` header if missing):
   - List commits since the previous tag: `git log <prev-tag>..HEAD --oneline`
     (all commits if no tag exists).
   - Prepend a `## vX.Y.Z - YYYY-MM-DD` section, grouping the changes under
     `### Added` / `### Changed` / `### Fixed` as applicable. Summarize
     user-facing changes in plain language; fold internal chores/refactors into
     one line or omit them.
   - Skip merge commits and the release commit itself.

5. **Agent version floor:** if the commits since the previous tag include a
   breaking change (a `!` subject or `BREAKING CHANGE`, or a removed/renamed route
   or payload the host or skills call), list them and ask the user whether to
   raise `MIN_AGENT_VERSION` in `apps/api/src/common/middleware/agent-version.ts`
   to the new version. If yes, bump it, move the boundary cases in
   `agent-version.test.ts`, and say in the changelog intro that older agents are
   refused. Skip the question if the user already said in the arguments.

6. **Commit:** stage the four version files + `CHANGELOG.md` (plus the
   agent-version files if bumped), commit `chore: release vX.Y.Z`.

7. **Tag:** `git tag -a vX.Y.Z -m "JobPilot vX.Y.Z"`.

8. **Report:** show the new version and tag, and remind the user to run
   `git push && git push origin vX.Y.Z` to trigger `release.yml`.

## Do NOT

- Do not push - the user pushes when ready.
- Do not let the four version fields drift - bump all to the same value.
- Do not use `--no-verify` / `--no-gpg-sign` if hooks fail - report instead.
- Do not amend a previous commit to roll the version - always a new commit.

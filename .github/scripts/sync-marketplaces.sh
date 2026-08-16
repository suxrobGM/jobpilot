#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: sync-marketplaces.sh <jobpilot-root> <claude-marketplace-root> <codex-marketplace-root>" >&2
  exit 2
fi

repo_root="$(cd "$1" && pwd)"
claude_root="$(cd "$2" && pwd)"
codex_root="$(cd "$3" && pwd)"
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

claude_stage="$staging/claude"
codex_stage="$staging/codex"

mkdir -p \
  "$claude_stage/.claude-plugin" \
  "$claude_stage/skills/setup" \
  "$codex_stage/.codex-plugin" \
  "$codex_stage/skills/setup"

# Claude's marketplace is the setup bootstrap. Dashboard Claude loads the bundled full plugin.
rsync -a --checksum "$repo_root/plugin/.claude-plugin/" "$claude_stage/.claude-plugin/"
rsync -a --checksum "$repo_root/plugin/skills/setup/" "$claude_stage/skills/setup/"

# Codex's marketplace is also bootstrap-only. The terminal host owns runtime skills and MCP wiring.
rsync -a --checksum "$repo_root/plugin/.codex-plugin/" "$codex_stage/.codex-plugin/"
rsync -a --checksum "$repo_root/plugin/skills/setup/" "$codex_stage/skills/setup/"

# --checksum is intentional: release manifests often retain size and checkout-time mtimes while content changes.
rsync -a --checksum --delete "$claude_stage/" "$claude_root/plugins/jobpilot/"
rsync -a --checksum --delete "$codex_stage/" "$codex_root/plugins/jobpilot/"

release_version="$(jq -er '.version' "$repo_root/package.json")"
test "$(jq -er '.version' "$repo_root/plugin/.claude-plugin/plugin.json")" = "$release_version"
test "$(jq -er '.version' "$repo_root/plugin/.codex-plugin/plugin.json")" = "$release_version"
test "$(jq -er '.version' "$claude_root/plugins/jobpilot/.claude-plugin/plugin.json")" = "$release_version"
test "$(jq -er '.version' "$codex_root/plugins/jobpilot/.codex-plugin/plugin.json")" = "$release_version"

cmp "$repo_root/plugin/.codex-plugin/plugin.json" "$codex_root/plugins/jobpilot/.codex-plugin/plugin.json"
cmp "$repo_root/plugin/skills/setup/SKILL.md" "$codex_root/plugins/jobpilot/skills/setup/SKILL.md"
test ! -e "$codex_root/plugins/jobpilot/.mcp.json"
test ! -e "$codex_root/plugins/jobpilot/skills/pilot"
test ! -e "$codex_root/plugins/jobpilot/skills/_shared"

jq -e '
  .name == "sukhrob-codex-plugins" and
  ([.plugins[] | select(.name == "jobpilot")] | length) == 1 and
  (.plugins[] | select(.name == "jobpilot") |
    .source.source == "local" and
    .source.path == "./plugins/jobpilot" and
    .policy.installation == "AVAILABLE" and
    .policy.authentication == "ON_USE" and
    .category == "Productivity")
' "$codex_root/.agents/plugins/marketplace.json" >/dev/null

import type { TerminalProviderId } from "@/lib/terminal/client";

export const CODEX_PLUGIN_ADD_COMMAND = "codex plugin add jobpilot@sukhrob-codex-plugins";

/** Marketplace-add + plugin-install commands per provider (see docs/getting-started). */
export const PLUGIN_COMMANDS: Record<TerminalProviderId, readonly string[]> = {
  claude: [
    "/plugin marketplace add https://github.com/suxrobGM/claude-plugins",
    "/plugin install jobpilot@sukhrob-claude-plugins",
  ],
  codex: ["codex plugin marketplace add suxrobGM/codex-plugins", CODEX_PLUGIN_ADD_COMMAND],
};

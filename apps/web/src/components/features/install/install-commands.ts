import { useSyncExternalStore } from "react";

const GITHUB_REPO = "suxrobGM/jobpilot";
const INSTALL_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/apps/terminal`;

/** Lists published releases, latest first. */
export const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

const INSTALL_COMMANDS = [
  { label: "Windows (PowerShell)", command: `irm ${INSTALL_BASE}/install.ps1 | iex` },
  { label: "macOS / Linux", command: `curl -fsSL ${INSTALL_BASE}/install.sh | bash` },
] as const;

type InstallCommand = (typeof INSTALL_COMMANDS)[number];

const noSubscription = () => () => {};

// Reordered after hydration: the server can't see the OS, so reading navigator in render mismatches.
const isWindows = (): boolean => /win/i.test(navigator.userAgent);
const isWindowsOnServer = (): boolean => true;

export function useOrderedInstallCommands(): readonly InstallCommand[] {
  const windows = useSyncExternalStore(noSubscription, isWindows, isWindowsOnServer);
  return windows ? INSTALL_COMMANDS : [INSTALL_COMMANDS[1], INSTALL_COMMANDS[0]];
}

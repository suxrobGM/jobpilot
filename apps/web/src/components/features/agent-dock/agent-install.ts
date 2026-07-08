const GITHUB_REPO = "suxrobGM/jobpilot";
const INSTALL_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/apps/terminal`;

/** GitHub API endpoint listing published releases (latest first). */
export const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

const INSTALL_COMMANDS = [
  { label: "Windows (PowerShell)", command: `irm ${INSTALL_BASE}/install.ps1 | iex` },
  { label: "macOS / Linux", command: `curl -fsSL ${INSTALL_BASE}/install.sh | bash` },
] as const;

type InstallCommand = (typeof INSTALL_COMMANDS)[number];

/** True when the visitor's browser reports Windows; false during SSR (no navigator). */
export const isWindows = (): boolean =>
  typeof navigator !== "undefined" && /win/i.test(navigator.userAgent);

/** Install commands with the visitor's OS first. */
export function orderedInstallCommands(): readonly InstallCommand[] {
  return isWindows() ? INSTALL_COMMANDS : [INSTALL_COMMANDS[1], INSTALL_COMMANDS[0]];
}

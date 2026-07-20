#!/usr/bin/env bash
# JobPilot Terminal installer for Linux and macOS.
# Usage: curl -fsSL https://raw.githubusercontent.com/suxrobGM/jobpilot/main/apps/terminal/install.sh | bash

set -euo pipefail

REPO="suxrobGM/jobpilot"
INSTALL_DIR="${JOBPILOT_INSTALL_DIR:-$HOME/.jobpilot}"
BINARY_NAME="jobpilot"

TMP_DIR=""
cleanup() { [ -n "$TMP_DIR" ] && rm -rf "$TMP_DIR"; }
trap cleanup EXIT

info() { printf "\033[0;32m%s\033[0m\n" "$1"; }
error() { printf "\033[0;31mError: %s\033[0m\n" "$1" >&2; exit 1; }

detect_platform() {
  local os arch rid
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Linux*)  os="linux" ;;
    Darwin*) os="osx" ;;
    *)       error "Unsupported OS: $os" ;;
  esac

  case "$arch" in
    x86_64|amd64)  arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)             error "Unsupported architecture: $arch" ;;
  esac

  echo "${os}-${arch}"
}

get_latest_version() {
  local version
  version=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases" \
    | grep -o '"tag_name": *"v[^"]*"' \
    | sed 's/.*"v\([^"]*\)".*/\1/' \
    | sort -t. -k1,1n -k2,2n -k3,3n \
    | tail -1)
  if [ -z "$version" ]; then
    error "Could not determine the latest version. See https://github.com/${REPO}/releases"
  fi
  echo "v${version}"
}

download_and_install() {
  local rid="$1" version="$2"
  local tag="${version}"
  local archive="jobpilot-terminal-${rid}.tar.gz"
  local url="https://github.com/${REPO}/releases/download/${tag}/${archive}"

  TMP_DIR="$(mktemp -d)"
  info "Downloading JobPilot Terminal ${version} for ${rid}..."
  if ! curl -fsSL -o "${TMP_DIR}/${archive}" "$url"; then
    error "Download failed. Check that the release exists: $url"
  fi

  info "Extracting to ${INSTALL_DIR}..."
  mkdir -p "$INSTALL_DIR"
  # Archive holds the binary plus the bundled plugin/ tree; extract it all.
  tar -xzf "${TMP_DIR}/${archive}" -C "$INSTALL_DIR"
  chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

}

setup_path() {
  if echo "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
    return
  fi
  local shell_config=""
  case "${SHELL:-}" in
    */zsh)  shell_config="$HOME/.zshrc" ;;
    */bash) shell_config="$HOME/.bashrc" ;;
    */fish) shell_config="$HOME/.config/fish/config.fish" ;;
  esac
  local export_line="export PATH=\"${INSTALL_DIR}:\$PATH\""
  if [ -n "$shell_config" ] && [ -f "$shell_config" ]; then
    if ! grep -q "$INSTALL_DIR" "$shell_config" 2>/dev/null; then
      printf '\n# JobPilot Terminal\n%s\n' "$export_line" >> "$shell_config"
      info "Added $INSTALL_DIR to PATH in $shell_config"
      info "Run: source $shell_config"
    fi
  else
    info "Could not detect shell config. Add this to your shell profile:"
    info "$export_line"
  fi
}

main() {
  info "JobPilot Terminal Installer"
  local rid version
  rid=$(detect_platform)
  info "Detected platform: $rid"
  version=$(get_latest_version)
  info "Latest version: $version"
  download_and_install "$rid" "$version"
  setup_path
  info ""
  info "JobPilot Terminal installed to ${INSTALL_DIR}"
  info "Run: ${BINARY_NAME}"
}

main "$@"

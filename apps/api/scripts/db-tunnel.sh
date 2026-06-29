#!/usr/bin/env bash
# SSH tunnel to a remote Postgres. Config from apps/api/.env (env overrides). Run: bun run db:tunnel
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

cfg() {
  local key="$1" def="${2-}" val
  val="$(printenv "$key" 2>/dev/null || true)"
  if [ -z "$val" ] && [ -f "$ENV_FILE" ]; then
    val="$(grep -E "^[[:space:]]*$key=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
    val="${val%$'\r'}"; val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
  fi
  printf '%s' "${val:-$def}"
}

SSH_HOST="$(cfg SSH_TUNNEL_HOST)"
SSH_USER="$(cfg SSH_TUNNEL_USER root)"
SSH_PORT="$(cfg SSH_TUNNEL_PORT 22)"
SSH_KEY="$(cfg SSH_TUNNEL_KEY)"
REMOTE_DB_HOST="$(cfg REMOTE_DB_HOST 127.0.0.1)"
REMOTE_DB_PORT="$(cfg REMOTE_DB_PORT 5432)"
LOCAL_DB_PORT="$(cfg LOCAL_DB_PORT 5433)"
SSH_KEY="${SSH_KEY/#\~/$HOME}"

if [ -z "$SSH_HOST" ] || [ -z "$SSH_USER" ]; then
  echo "Missing SSH_TUNNEL_HOST / SSH_TUNNEL_USER in apps/api/.env (see apps/api/.env.example)." >&2
  exit 1
fi

ssh_args=(
  -N
  -L "${LOCAL_DB_PORT}:${REMOTE_DB_HOST}:${REMOTE_DB_PORT}"
  -p "$SSH_PORT"
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=3
  -o ExitOnForwardFailure=yes
)
[ -n "$SSH_KEY" ] && ssh_args+=(-i "$SSH_KEY")
ssh_args+=("${SSH_USER}@${SSH_HOST}")

echo "SSH tunnel: localhost:${LOCAL_DB_PORT} -> ${REMOTE_DB_HOST}:${REMOTE_DB_PORT} via ${SSH_USER}@${SSH_HOST}:${SSH_PORT}"
echo "DATABASE_URL=postgresql://<user>:<pass>@localhost:${LOCAL_DB_PORT}/<db>  (Ctrl+C to close)"
echo

exec ssh "${ssh_args[@]}"

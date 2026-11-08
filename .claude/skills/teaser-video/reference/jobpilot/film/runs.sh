#!/usr/bin/env bash
# Pilot runs and requests from the last 2 hours, to know when a take's work is done.
#   bash runs.sh <repo> <user-email>
# Reads DATABASE_URL from apps/api/.env at run time; never paste the URL into a file.
set -euo pipefail
REPO="$1"
EMAIL="$2"
PSQL="${PSQL:-/c/Program Files/PostgreSQL/18/bin/psql.exe}"
URL=$(grep -E "^DATABASE_URL=" "$REPO/apps/api/.env" | cut -d= -f2- | tr -d '"' | sed 's/?.*//')
q() { "$PSQL" "$URL" -At -F' | ' -c "$1"; }
USER_ID=$(q "select id from users where email='$EMAIL'")
q "select task_type, coalesce(outcome::text,'open'), to_char(started_at,'HH24:MI:SS'), to_char(finished_at,'HH24:MI:SS'), title from pilot_runs where user_id='$USER_ID' and started_at > now() - interval '2 hours' order by started_at"
q "select task_type, status, to_char(created_at,'HH24:MI:SS'), payload::text from pilot_requests where user_id='$USER_ID' and created_at > now() - interval '2 hours' order by created_at"

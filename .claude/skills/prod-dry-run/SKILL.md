---
name: prod-dry-run
description: Dump the production database through the tunnel, restore it over the local dev DB, apply pending migrations, and check the app against real data. Use for "dump prod", "restore prod locally", "dry-run migrations on a prod copy", or testing a branch against prod data.
---

# Prod dry run

Prod is read-only here: the tunnel is used for `pg_dump` and nothing else. The local dev DB is
overwritten, so back it up first.

## Setup

- Tools: `C:\Program Files\PostgreSQL\18\bin` (`pg_dump`, `pg_restore`, `psql`). Not on PATH.
- URLs: `apps/api/.env` has a `DATABASE_URL` for local `:5432` and one for the tunnel `:5433`;
  one is commented out. Take the user, password and DB from each. `%23` in a URL is `#`.
- Export `DATABASE_URL` for local `:5432` in every command below, whatever `.env` has active.
- Nothing may be connected to the local DB: `curl localhost:4101/api/health` must fail. A
  running dev API would run maintenance and send pushes to real users' devices.

## Steps

1. **Tunnel.** `bun run db:tunnel` in the background. Poll `psql -h localhost -p 5433 ... -c
   "select 1"` until it answers. Note prod's latest `_prisma_migrations` rows and the users and
   `pilot_runs` counts.
2. **Dump.** Into `.tmp/prod-dump/` (gitignored):
   - prod: `pg_dump -h localhost -p 5433 ... -Fc -f prod-<date>.dump`
   - local backup: `pg_dump -h localhost -p 5432 ... -Fc -f local-before-<date>.dump`

   Then stop the tunnel.
3. **Restore.** On `:5432` against `postgres`: terminate `jobpilot` backends, `drop database
   jobpilot`, `create database jobpilot`, then `pg_restore --no-owner --no-acl -d jobpilot
   prod-<date>.dump`. Confirm the counts match step 1.
4. **Migrate.** `bun --cwd=apps/api run db:migrate:apply`. Then `bun --cwd=apps/api run
   db:diff` must print an empty migration. Prisma misses partial indexes, so also confirm the
   hand-written ones survive (`select indexname from pg_indexes where tablename='pilot_runs'`).
5. **SQL checks.** Query what the new migrations backfill or drop: null counts on new columns,
   rows a backfill missed (grouped by type and date), and data the branch's behavior changes now
   act on (for example, unanswered messages that will get a reply after deploy).
6. **App checks.** Run this skill's script from `apps/api` (so `.env` loads) with push disabled:

   ```bash
   cd apps/api
   DATABASE_URL=<local> VAPID_PRIVATE_KEY= bun ../../.claude/skills/prod-dry-run/scripts/check.ts
   ```

   For every user it parses every run payload, loads up to 5 thread pages, loads run history, and
   builds a task list. Mail sync, maintenance and the digest are stubbed. It must print
   `Failures: 0`. For branch-specific live checks, write a scratch script beside it the same way
   (services built with `new X(db)`), delete any rows it creates, then delete the script.
7. **Clean up.** Delete `.tmp/prod-dump/` once the user is done with the backups. Local now holds the migrated prod copy; restore `local-before-*.dump` with
   step 3 if the user wants the old data back.

## Report

Prod's state (migrations, counts), each migration applied, drift result, the SQL findings, the
app-check totals and failures, and what deploying will visibly change for users.

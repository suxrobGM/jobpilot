-- Data-only, paired with the counts.activeLeases -> counts.activeClaims rename: agenda_snapshot
-- persists a whole AgendaResponse, so one written by the previous build 500s on read until it expires.
-- Discarding is lossless - it is a 5-minute cache the next refresh rebuilds.

UPDATE "pilot_states"
SET "agenda_snapshot" = NULL,
    "agenda_expires_at" = NULL
WHERE "agenda_snapshot" -> 'counts' ? 'activeLeases';

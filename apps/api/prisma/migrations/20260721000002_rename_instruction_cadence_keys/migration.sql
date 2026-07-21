-- Data-only migration: rename persisted keys in pilot_states.instructions_config (jsonb)
-- to match the contracts rename (packages/contracts/src/pilot/instructions.ts):
--   savedSearches[].cadenceHours       -> savedSearches[].checkEveryHours
--   promotion.platforms[].cadenceDays  -> promotion.platforms[].postEveryDays
-- Idempotent: each UPDATE is guarded by an EXISTS check for the old key, so a
-- re-run (or a row already in the new shape) is a no-op. Elements lacking the
-- old key are left untouched; no keys are invented.

UPDATE "pilot_states"
SET "instructions_config" = jsonb_set(
  "instructions_config",
  '{savedSearches}',
  (
    SELECT COALESCE(
      jsonb_agg(
        CASE
          WHEN elem ? 'cadenceHours'
            THEN (elem - 'cadenceHours') || jsonb_build_object('checkEveryHours', elem->'cadenceHours')
          ELSE elem
        END
      ),
      '[]'::jsonb
    )
    FROM jsonb_array_elements("instructions_config"->'savedSearches') AS elem
  ),
  false
)
WHERE jsonb_typeof("instructions_config"->'savedSearches') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements("instructions_config"->'savedSearches') AS elem
    WHERE elem ? 'cadenceHours'
  );

UPDATE "pilot_states"
SET "instructions_config" = jsonb_set(
  "instructions_config",
  '{promotion,platforms}',
  (
    SELECT COALESCE(
      jsonb_agg(
        CASE
          WHEN elem ? 'cadenceDays'
            THEN (elem - 'cadenceDays') || jsonb_build_object('postEveryDays', elem->'cadenceDays')
          ELSE elem
        END
      ),
      '[]'::jsonb
    )
    FROM jsonb_array_elements("instructions_config"->'promotion'->'platforms') AS elem
  ),
  false
)
WHERE jsonb_typeof("instructions_config"->'promotion'->'platforms') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements("instructions_config"->'promotion'->'platforms') AS elem
    WHERE elem ? 'cadenceDays'
  );

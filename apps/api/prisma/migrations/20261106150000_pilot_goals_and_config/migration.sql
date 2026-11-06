-- Users read "goals and rules", never "instructions"; the columns follow.
ALTER TABLE "pilot_states" RENAME COLUMN "instructions_goals" TO "goals";
ALTER TABLE "pilot_states" RENAME COLUMN "instructions_config" TO "config";
ALTER TABLE "pilot_states" RENAME COLUMN "instructions_updated_at" TO "goals_updated_at";
-- "Run now" is a request now.
ALTER TABLE "pilot_states" DROP COLUMN "job_alerts_requested_at", DROP COLUMN "research_requested_at";

-- Preferring cap-exempt employers, and the min score, are pilot rules. A rule already set wins.
INSERT INTO "pilot_states" ("user_id", "updated_at")
SELECT "user_id", now() FROM "profiles" WHERE "prefer_cap_exempt"
UNION
SELECT "user_id", now() FROM "auto_apply_settings" WHERE "min_match_score" <> 60
ON CONFLICT ("user_id") DO NOTHING;

UPDATE "pilot_states" s SET "config" = s."config" || '{"preferCapExempt": true}'
FROM "profiles" p
WHERE p."user_id" = s."user_id" AND p."prefer_cap_exempt" AND NOT s."config" ? 'preferCapExempt';

UPDATE "pilot_states" s SET "config" = s."config" || jsonb_build_object('minScore', a."min_match_score")
FROM "auto_apply_settings" a
WHERE a."user_id" = s."user_id" AND a."min_match_score" <> 60 AND NOT s."config" ? 'minScore';

ALTER TABLE "profiles" DROP COLUMN "prefer_cap_exempt";

-- A start date other than the default becomes the saved answer the applier already reads.
INSERT INTO "profile_answers" ("id", "user_id", "key", "value", "created_at", "updated_at")
SELECT gen_random_uuid(), "user_id", 'start_date', btrim("default_start_date"), now(), now()
FROM "auto_apply_settings"
WHERE btrim("default_start_date") NOT IN ('', '2 weeks notice')
ON CONFLICT ("user_id", "key") DO NOTHING;

DROP TABLE "auto_apply_settings";

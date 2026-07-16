ALTER TABLE "promotion_posts" RENAME COLUMN "venue" TO "platform";
UPDATE "pilot_states" SET "instructions_config" = replace(replace(replace(
  "instructions_config", '"standingQueries"', '"savedSearches"'), '"venues"', '"platforms"'), '"venue"', '"platform"');
UPDATE "pilot_leases" SET "subject_id" = replace("subject_id", 'venue:', 'platform:') WHERE "subject_type" = 'promotion';

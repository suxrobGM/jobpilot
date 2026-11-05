-- Ids become native uuid and timestamps timestamptz. Every foreign key is dropped and re-created from
-- its own definition, since both ends of a key must change type together. Indexes rebuild themselves.
CREATE TEMP TABLE uuid_columns (table_name TEXT, column_name TEXT);
INSERT INTO uuid_columns VALUES
  ('applications', 'id'),
  ('applications', 'user_id'),
  ('applications', 'board_id'),
  ('applications', 'campaign_id'),
  ('applications', 'job_id'),
  ('applications', 'resume_id'),
  ('applications', 'resume_variant_id'),
  ('application_events', 'id'),
  ('application_events', 'application_id'),
  ('verification_tokens', 'id'),
  ('verification_tokens', 'user_id'),
  ('oauth_accounts', 'id'),
  ('oauth_accounts', 'user_id'),
  ('auth_tokens', 'id'),
  ('auth_tokens', 'user_id'),
  ('campaign_jobs', 'id'),
  ('campaign_jobs', 'user_id'),
  ('campaign_jobs', 'campaign_id'),
  ('campaign_jobs', 'board_id'),
  ('campaigns', 'id'),
  ('campaigns', 'user_id'),
  ('campaigns', 'board_id'),
  ('campaigns', 'pilot_search_id'),
  ('cover_letters', 'id'),
  ('cover_letters', 'user_id'),
  ('cover_letters', 'application_id'),
  ('credentials', 'id'),
  ('credentials', 'user_id'),
  ('credentials', 'board_id'),
  ('email_accounts', 'id'),
  ('email_accounts', 'user_id'),
  ('email_oauth_clients', 'id'),
  ('email_oauth_clients', 'user_id'),
  ('email_messages', 'id'),
  ('email_messages', 'account_id'),
  ('email_messages', 'application_id'),
  ('job_boards', 'id'),
  ('user_job_boards', 'id'),
  ('user_job_boards', 'user_id'),
  ('user_job_boards', 'board_id'),
  ('job_listings', 'id'),
  ('job_listing_sources', 'id'),
  ('job_listing_sources', 'listing_id'),
  ('job_listing_sources', 'board_id'),
  ('contacts', 'id'),
  ('contacts', 'user_id'),
  ('contacts', 'application_id'),
  ('networking_messages', 'id'),
  ('networking_messages', 'user_id'),
  ('networking_messages', 'contact_id'),
  ('networking_messages', 'campaign_id'),
  ('pilot_states', 'user_id'),
  ('pilot_searches', 'id'),
  ('pilot_searches', 'user_id'),
  ('pilot_searches', 'board_id'),
  ('pilot_searches', 'resume_id'),
  ('pilot_runs', 'id'),
  ('pilot_runs', 'user_id'),
  ('pilot_questions', 'id'),
  ('pilot_questions', 'user_id'),
  ('pilot_journal_entries', 'id'),
  ('pilot_journal_entries', 'user_id'),
  ('pilot_journal_entries', 'run_id'),
  ('promotion_posts', 'id'),
  ('promotion_posts', 'user_id'),
  ('profiles', 'user_id'),
  ('professional_references', 'id'),
  ('professional_references', 'user_id'),
  ('salary_preferences', 'id'),
  ('salary_preferences', 'user_id'),
  ('auto_apply_settings', 'id'),
  ('auto_apply_settings', 'user_id'),
  ('profile_answers', 'id'),
  ('profile_answers', 'user_id'),
  ('resumes', 'id'),
  ('resumes', 'user_id'),
  ('resume_variants', 'id'),
  ('resume_variants', 'resume_id'),
  ('resume_variants', 'application_id'),
  ('upwork_proposals', 'id'),
  ('upwork_proposals', 'user_id'),
  ('upwork_proposals', 'job_id'),
  ('upwork_profiles', 'id'),
  ('upwork_profiles', 'user_id'),
  ('upwork_accounts', 'id'),
  ('upwork_accounts', 'user_id'),
  ('upwork_inbox_items', 'id'),
  ('upwork_inbox_items', 'user_id'),
  ('users', 'id'),
  ('users', 'primary_resume_id'),
  ('web_push_subscriptions', 'id'),
  ('web_push_subscriptions', 'user_id')
;

-- Fail before touching anything if a value would not convert.
DO $$
DECLARE
  col RECORD;
  bad BIGINT;
BEGIN
  FOR col IN SELECT * FROM uuid_columns LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I WHERE %I IS NOT NULL AND %I !~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''',
      col.table_name, col.column_name, col.column_name
    ) INTO bad;
    IF bad > 0 THEN
      RAISE EXCEPTION '%.% holds % value(s) that are not uuids', col.table_name, col.column_name, bad;
    END IF;
  END LOOP;
END $$;

CREATE TEMP TABLE foreign_keys AS
SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace;

DO $$
DECLARE
  fk RECORD;
  col RECORD;
BEGIN
  FOR fk IN SELECT * FROM foreign_keys LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.table_name, fk.conname);
  END LOOP;

  FOR col IN SELECT * FROM uuid_columns LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE UUID USING %I::uuid', col.table_name, col.column_name, col.column_name);
  END LOOP;

  -- Prisma has always written UTC.
  FOR col IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.data_type = 'timestamp without time zone'
      AND c.table_name <> '_prisma_migrations'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMPTZ(3) USING %I AT TIME ZONE ''UTC''',
      col.table_name, col.column_name, col.column_name
    );
  END LOOP;

  FOR fk IN SELECT * FROM foreign_keys LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', fk.table_name, fk.conname, fk.definition);
  END LOOP;
END $$;

DROP TABLE foreign_keys;
DROP TABLE uuid_columns;

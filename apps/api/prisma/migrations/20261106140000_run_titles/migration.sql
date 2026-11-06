-- A run keeps the title its task had, so reading old runs never parses an old payload shape.
ALTER TABLE "pilot_runs" ADD COLUMN "title" TEXT;

UPDATE "pilot_runs" SET "title" = CASE "task_type"
  WHEN 'chat.reply' THEN 'Reply to your message'
  WHEN 'resume.extract' THEN 'Read your resume'
  WHEN 'resume.tailor' THEN 'Tailor a resume to a job'
  WHEN 'networking.find' THEN 'Find contacts: ' || ("payload"->>'criteria')
  WHEN 'networking.rewrite' THEN 'Rewrite ' || jsonb_array_length("payload"->'messageIds') || ' outreach draft(s)'
  WHEN 'upwork.profile' THEN CASE WHEN "payload"->>'mode' = 'apply'
    THEN 'Improve your Upwork profile' ELSE 'Review your Upwork profile' END
  WHEN 'upwork.proposal' THEN 'Write an Upwork proposal'
  WHEN 'upwork.submit' THEN 'Submit an Upwork proposal'
  WHEN 'question.answered' THEN 'Apply answer: ' || ("payload"->>'prompt')
  WHEN 'interview.reply' THEN 'Reply to interview invite: ' || ("payload"->>'company')
  WHEN 'board.diagnose' THEN 'Board failing: ' || ("payload"->>'board') || ' (' || ("payload"->>'consecutiveFailures') || ')'
  WHEN 'campaign.reviewPaused' THEN 'Review a paused search: ' || ("payload"->>'query')
  WHEN 'job.apply' THEN "payload"->>'jobTitle'
  WHEN 'interview.prep' THEN 'Interview prep: ' || ("payload"->>'jobTitle')
  WHEN 'queue.score' THEN 'Score ' || ("payload"->>'queuedCount') || ' pasted link(s)'
  WHEN 'networking.send' THEN 'Send networking message: ' || ("payload"->>'contactName')
  WHEN 'inbox.review' THEN 'Review ' || ("payload"->>'count') || ' inbox message(s)'
  WHEN 'upwork.syncInbox' THEN CASE WHEN coalesce("payload"->>'lastSyncedAt', '') <> ''
    THEN 'Refresh the Upwork inbox' ELSE 'Pull the Upwork inbox' END
  WHEN 'promotion.post' THEN 'Post to ' || ("payload"->>'platform')
  WHEN 'networking.warmIntro' THEN 'Warm intro: ' || ("payload"->>'jobTitle')
  WHEN 'search.setup' THEN 'Set up searches from your goals'
  WHEN 'campaign.scorePending' THEN 'Score discovered jobs: ' || ("payload"->>'query')
  WHEN 'inbox.jobAlerts' THEN 'Import jobs from ' || ("payload"->>'count') || ' alert email(s)'
  WHEN 'search.discover' THEN 'Discover: ' || ("payload"->>'query')
  WHEN 'research.explore' THEN 'Research jobs beyond your boards'
  WHEN 'networking.followup' THEN 'Follow up: ' || ("payload"->>'contactName')
  WHEN 'campaign.tune' THEN 'Tune a search: ' || ("payload"->>'query')
  WHEN 'promotion.draft' THEN 'Draft post: ' || ("payload"->>'platform')
  WHEN 'job.rescanSkipped' THEN 'Rescan ' || ("payload"->>'skippedCount') || ' skipped job(s)'
  WHEN 'job.retryFailed' THEN 'Retry ' || ("payload"->>'failedCount') || ' failed job(s)'
END;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "pilot_runs" WHERE "title" IS NULL) THEN
    RAISE EXCEPTION 'pilot_runs holds a run whose task type or payload has no title';
  END IF;
END $$;

ALTER TABLE "pilot_runs" ALTER COLUMN "title" SET NOT NULL;

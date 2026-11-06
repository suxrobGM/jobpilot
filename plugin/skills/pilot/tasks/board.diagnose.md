# `board.diagnose`

Payload `{boardId, board, consecutiveFailures, recentFailReasons, testJob}` (`board` is the
domain): the board keeps failing. Find
out why without applying. Log in per `../../_shared/auth.md`; that alone often shows the cause
(expired login, changed flow, bot wall). When `testJob` is set, open its `url` and check that the
posting and its apply form load.

- Board looks usable → `POST /api/feeds/<testJob.feedId>/jobs/<testJob.jobKey>/retry` with
  `{"retryNotes":"<what you found>"}`. A later `job.apply` run is the real test: its success resets
  the streak, its failure brings this task back.
- Still broken → leave the job failed. Ask nothing: the user fixes credentials or drops the board
  after reading the summary.

Summary: "Board <board> looks healthy - login works, retrying <company> as the test." /
"Board <board> still failing - login page returns a bot wall."

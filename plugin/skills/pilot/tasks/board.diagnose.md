# `board.diagnose`

Payload `{boardId, board, consecutiveFailures, recentFailReasons, testJob}` (`board` is the
domain). The board keeps failing; find out why without applying.

Log in per `../../_shared/auth.md`; that alone often shows the cause (expired login, changed flow,
bot wall). When `testJob` is set, open its `url` and check that the posting and its apply form
load.

- Looks usable: `POST /api/feeds/<testJob.feedId>/jobs/<testJob.jobKey>/retry`
  `{"retryNotes":"<what you found>"}`. The next `job.apply` run is the real test: success resets
  the failure streak, failure brings this task back.
- Still broken: leave the job failed and ask nothing. The user fixes the login or drops the board
  after reading the summary.

Summary: "Board <board> looks healthy - login works, retrying <company> as the test." / "Board
<board> still failing - login page returns a bot wall."

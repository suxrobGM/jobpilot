# `job.retryFailed`

Payload `{feedId, failedCount}`. Page through `GET /api/feeds/$FEED_ID/jobs --query
status=failed`. For each job whose `failReason` is transient (timeout, 5xx, lost session; never an
eligibility reason), `POST /api/feeds/$FEED_ID/jobs/<key>/retry` with
`{"retryNotes":"<its retryNotes>"}`. Don't apply; `job.apply` runs pick them up.

Summary: "Queued 3 of 5 failed jobs for retry - 2 were eligibility failures."

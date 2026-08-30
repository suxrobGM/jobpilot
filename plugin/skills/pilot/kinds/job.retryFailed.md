# `job.retryFailed`

Payload `{campaignId, failedCount}`. Follow `auto-apply`'s retry-failed mode for this campaign, but score/queue only - POST each retryable job's `/retry` command so normal `job.apply` cycles retry it; do **not** apply this cycle. Retryable = transient `failReason`s (timeouts, 5xx, session lost), never eligibility skips. Journal with detail `{type:"retryFailed"}`.

# `networking.rewrite`

Payload `{requestId, messageIds}`: the user wants these drafts rewritten. The drafts can belong to
different campaigns: read each with `GET /api/networking/messages` (match on `id`), group them by
`campaignId`, and run the `networking` skill's rewrite mode (`../../networking/SKILL.md`) once per
campaign: `--campaign <campaignId> --rewrite <ids of that campaign>`.

Summary: "Rewrote 4 outreach drafts."

# `networking.rewrite`

Payload `{requestId, messageIds}`: the user wants these drafts rewritten. The drafts can belong to
different feeds: read each with `GET /api/networking/messages` (match on `id`), group them by
`feedId`, and run the `networking` skill's rewrite mode (`../../networking/SKILL.md`) once per
feed: `--feed <feedId> --rewrite <ids of that feed>`.

Summary: "Rewrote 4 outreach drafts."

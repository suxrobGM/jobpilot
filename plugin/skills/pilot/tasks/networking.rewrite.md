# `networking.rewrite`

Payload `{requestId, messageIds}`: rewrite these drafts. They can belong to different feeds: find
each in `GET /api/networking/messages` (match on `id`), group by `feedId`, and run the `networking`
skill's rewrite mode (`../../networking/SKILL.md`) once per feed: `--feed <feedId> --rewrite <ids>`.

Summary: "Rewrote 4 outreach drafts."

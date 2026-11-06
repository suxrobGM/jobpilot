# `networking.warmIntro`

Payload `{feedId, jobKey, company, jobTitle, jobUrl, contacts, channel, autonomy}`. Delegate one
`networking-worker` run on the given `channel`:

- `contacts` set → compose for the best one only: pass it as `target`, with the job for grounding.
- `contacts` empty (the usual case) → discover and compose: `target:{jobUrl, title:<jobTitle>,
  company}`.

Save the returned contact and draft as the `networking` skill's "Save the returned draft" does and
keep the draft's `id`. Then apply the autonomy gate of `./networking.followup.md` to this payload's
`autonomy`.

Summary: "Found warm path to Acme: Dana Lee (Eng Manager) - intro drafted."

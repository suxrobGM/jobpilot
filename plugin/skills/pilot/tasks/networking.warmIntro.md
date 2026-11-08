# `networking.warmIntro`

Payload `{feedId, jobKey, company, jobTitle, jobUrl, contacts, channel, autonomy}`. Delegate one
`networking-worker` run on `channel`:

- `contacts` set: pass the best one as `target`, with the job for grounding.
- `contacts` empty (the usual case): `target:{jobUrl, title:jobTitle, company}`.

Save the contact and draft as the `networking` skill's **Save drafts** section does and keep the
draft's `id`. Then apply the autonomy gate from `./networking.followup.md`.

Summary: "Found warm path to Acme: Dana Lee (Eng Manager) - intro drafted."

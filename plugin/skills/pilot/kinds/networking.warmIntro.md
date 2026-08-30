# `networking.warmIntro`

Payload `{campaignId, jobKey, company, jobTitle, jobUrl, contacts, channel, autonomy}`. The server already picked the `channel`, so compose on it rather than re-deciding. Delegate **one** `networking-worker` invocation:

- `contacts` non-empty → compose only for the best contact (pass it as `target`, like the `networking` skill's rewrite mode, with the job for grounding); the worker composes, never sends.
- `contacts` empty → discover **and** compose for the company/job (`target:{jobUrl, title:<jobTitle>, company}`). An empty list is the normal early case and the point of the item, not a reason to stop.

Save the returned contact + draft via the campaign networking endpoints exactly as the `networking` skill's "Save the returned draft"; capture the saved draft's message `id`. Then apply the **same autonomy gate** as `./networking.followup.md`, against this item's `autonomy`. Journal e.g. "Found warm path to Acme: Dana Lee (Eng Manager) - intro drafted."

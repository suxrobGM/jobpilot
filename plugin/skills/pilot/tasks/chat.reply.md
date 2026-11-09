# `chat.reply`

Payload `{messageId, openRequests?}`: the user wrote to you. `openRequests` is work already queued
or running (`taskType`, `status`, `payload`). No browser unless the question needs one.

## 1. Read

```bash
jobpilot-api GET /api/pilot/messages --query limit=20
jobpilot-api GET /api/pilot
```

Answer every user message since your last reply, in one reply. Answer from API data
(`GET /api/feeds?kind=search`, `GET /api/pipeline/jobs`, `GET /api/pipeline/counts`,
`GET /api/applications`), never from memory. Say when you don't know.

## 2. Act on what was asked, and only that

**What the user says wins.** Your minimum score, deal-breakers and earlier skips are your own
calls; when the user names a job, apply to it whatever its score or why it was skipped or failed.
Never tell them to lower a setting to get one job through. Only an application already sent stops
it.

**Job links** the user pasted, to apply to or just to add:

```bash
jobpilot-api POST /api/pipeline/links --data '{"urls":["<url>","<url>"]}'
```

It returns `jobs`: one `{url, feedId, key, status}` per link, new or already in the pipeline. To
apply, queue one `job.apply {feedId, jobKey: key}` per job (below); `status` `applied` means it was
already sent, so say so instead. Never build a job by hand or guess a feed or key. Links with no
ask to apply are added and get scored.

**A job they named** ("apply to the Garmin one"): find it with `GET /api/pipeline/jobs --query
view=<view> --query search=<company or title>`, trying `notApplied`, `inProgress`, then `review`
(`.items`, each with `feedId` and `key`), then queue `job.apply` for that one job. One named job is
one job: never `job.retryFailed` or a whole-search rescan for it. A rescan of chosen jobs takes
`jobKeys`, plus `minScore` when the user named a bar.

**What jobs they want** ("senior frontend roles, remote, nothing crypto"). This is how the user
sets you up, so make it one applied change: create or rewrite 1-5 searches, each a different
angle; put hard limits in `dealBreakers`; give every search a `reason` in the user's terms
("Series A-C startups; needs OPT sponsorship"), since later runs know the intent only from it.
Delete searches that no longer fit. With autopilot off (`GET /api/pilot` `autopilot`), end the
reply saying the searches start once they turn it on.

**Searches from their resume** ("set up searches from my resume", no roles named): don't derive
them here. Queue `search.setup {}`; it reads every resume and runs after this reply.

**Getting started** ("how do I set this up"): no resume yet (`GET /api/resumes`): ask them to add
one on the Resumes page. Then ask what jobs they want, or offer `search.setup` from the resume.
Last, autopilot: on, you search and apply on your own; off, only what they ask. Plain steps, no
settings jargon.

**A clear instruction** to change rules, searches or standing answers ("stop applying to jobs that
need clearance") is an applied change:

```bash
jobpilot-api POST /api/pilot/changes --data @"$JOBPILOT_TEMP/change.json"
```

```json
{ "summary": "Skip jobs that need clearance", "source": "chat",
  "actions": [{ "type": "rules.set", "dealBreakers": ["security clearance"] }] }
```

- Actions: `rules.set`, `search.create`, `search.update`, `search.pause`, `search.resume`,
  `search.delete`, `answer.set`, `answer.delete`, `jobs.skip`.
- `rules.set` replaces the whole `dealBreakers` list: send the current list plus the new rule.
- `search.create` takes a plain `name` ("University labs, PA"). Give it a `board` (a domain) only
  when the user names one: a pinned search always runs there instead of rotating boards.
  `search.update` with `"board": null` unpins.

**Something they didn't ask for** but you think would help: the same body with `"propose": true`.
The user applies or dismisses it. Offer a suggestion once: if an earlier reply already made it,
don't repeat it.

**Work** ("apply to the Brex job", "find recruiters at Waymo") becomes a request that runs after
this reply. Asking for work already in `openRequests` returns that request, so tell the user it's
already queued:

```bash
jobpilot-api POST /api/pilot/requests --data '{"taskType":"networking.find","payload":{"criteria":"recruiters at Waymo"},"source":"chat"}'
```

Types: `job.apply {feedId, jobKey}`, `job.rescanSkipped {feedId, jobKeys?, minScore?}`,
`job.retryFailed {feedId}`, `inbox.review {}`, `upwork.syncInbox {}`,
`search.discover {searchId}`, `search.setup {}`, `resume.extract {resumeId}`,
`resume.tailor {jobDescription}`, `networking.find {criteria}`, `upwork.profile {mode}`,
`research.explore {focus?}`.

A refused request names why in `message`: tell the user that, in plain words, and stop. Don't
queue a different task to work around it.

Asked to find more jobs, look beyond the boards, or search somewhere specific (labs, a city,
career pages): queue `research.explore`, with `focus` in the user's words when they narrowed it.

Queued work reports back in this chat when it finishes, so say so ("I'll tell you how it goes");
never ask the user to come back and ask. A CAPTCHA or sign-in the user offers to handle: the
application asks them in Needs you when it reaches it, so they solve it in the open browser tab.

## 3. Reply

Post the result with the reply in `detail.reply`: short markdown, plain words. Say what you changed
(the user can undo it) and what you queued. Describe jobs and outcomes, never internal states or
what "the app won't let" you do.

```json
{ "outcome": "done", "summary": "Replied: added a clearance deal-breaker and a PA labs search.",
  "detail": { "reply": "Done. I won't apply to jobs that need clearance, and I added a search for university labs in PA." } }
```

Summary: "Replied: <what you did, in a few words>."

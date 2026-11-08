# `chat.reply`

Payload `{messageId}`: the user wrote to you. No browser unless the question needs one.

1. Read the conversation and what it can be about:

   ```bash
   jobpilot-api GET /api/pilot/messages --query limit=20
   jobpilot-api GET /api/pilot
   ```

   Answer the newest user messages since your last reply, all of them in one reply. Answer from API
   data (`GET /api/feeds?kind=search`, `/api/pipeline/jobs`, `/api/pipeline/counts`,
   `/api/applications`), never from memory or guesses. Say when you don't know.

2. Act on what the user asked, and only that:
   - **What jobs the user wants** ("senior frontend roles, remote, nothing crypto"): this is how
     the user sets you up and steers you, so make it one applied change. Create or rewrite
     searches to cover it (1-5 in all, each a different angle), put hard limits in
     `dealBreakers`, and give every search a `reason` in the user's terms ("Series A-C startups;
     needs OPT sponsorship"): later runs know the intent only from it. Delete searches that no
     longer fit. With autopilot off (`GET /api/pilot` → `autopilot`), end the reply saying the
     searches start once they turn it on.
   - **A clear instruction** to change rules, searches or standing answers ("stop applying to
     jobs that need clearance", "add a search for PA university labs") becomes an applied change:

     ```bash
     jobpilot-api POST /api/pilot/changes --data @"$JOBPILOT_TEMP/change.json"
     ```

     ```json
     { "summary": "Skip jobs that need clearance", "source": "chat",
       "actions": [{ "type": "rules.set", "dealBreakers": ["security clearance"] }] }
     ```

     `rules.set` replaces the whole `dealBreakers` list: read the current one from `GET /api/pilot`
     and send it with the new rule added. Give `search.create` a `board` (its domain) only when the
     user names one; that search then always runs there instead of rotating the configured boards.
     `search.update` with a `board` pins an existing search, and `"board": null` unpins it.
     Actions: `rules.set`, `search.create` (`name` a plain label like "University labs, PA"),
     `search.update`, `search.pause`, `search.resume`, `search.delete`, `answer.set`,
     `answer.delete`, `jobs.skip`.
   - **Anything the user did not clearly ask for** but you think would help: the same body with
     `"propose": true`. The user applies or dismisses it.
   - **Work** the user asks for ("apply to the Brex job", "review my inbox", "find recruiters at
     Waymo") becomes a request; it runs after this reply:

     ```bash
     jobpilot-api POST /api/pilot/requests --data '{"taskType":"networking.find","payload":{"criteria":"recruiters at Waymo"},"source":"chat"}'
     ```

     Types: `job.apply {feedId, jobKey}`, `job.rescanSkipped {feedId, jobKeys?}`,
     `job.retryFailed {feedId}`, `inbox.review {}`, `upwork.syncInbox {}`, `search.discover
     {searchId}`, `resume.extract {resumeId}`, `resume.tailor {jobDescription}`, `networking.find
     {criteria}`, `upwork.profile {mode}`, `research.explore {focus?}`.

     Asked to find more jobs, look beyond the boards, or search somewhere specific (labs, a city,
     company career pages): queue `research.explore`, with `focus` in the user's words when they
     narrowed it. The reply says what will be searched and that new jobs land in Research.

   Never touch rules unless the user asked.

3. Post the result with the reply in `detail.reply`: markdown, short, plain words. Say what you
   changed (the user can undo it) and what you queued.

```json
{ "outcome": "done", "summary": "Replied: added a clearance deal-breaker and a PA labs search.",
  "detail": { "reply": "Done. I won't apply to jobs that need clearance, and I added a search for university labs in PA." } }
```

Summary: "Replied: <what you did, in a few words>."

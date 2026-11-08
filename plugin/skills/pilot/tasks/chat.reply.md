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
   - **A clear instruction** to change goals, rules, searches or standing answers ("stop applying to
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
     user names one; that search then always runs there instead of rotating the configured boards. Actions: `goals.set`, `rules.set`, `search.create`
     (`name` a plain label like "University labs, PA"), `search.update`, `search.pause`,
     `search.resume`, `search.delete`, `answer.set`, `answer.delete`, `jobs.skip`.
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
     {criteria}`, `upwork.profile {mode}`.

   Never touch goals or rules unless the user asked.

3. Post the result with the reply in `detail.reply`: markdown, short, plain words. Say what you
   changed (the user can undo it) and what you queued.

```json
{ "outcome": "done", "summary": "Replied: added a clearance deal-breaker and a PA labs search.",
  "detail": { "reply": "Done. I won't apply to jobs that need clearance, and I added a search for university labs in PA." } }
```

Summary: "Replied: <what you did, in a few words>."

---
name: autopilot
description: Autonomously search job boards and apply to matching positions in batch. Tracks progress in a JSON file for resumability. User approves a batch once, then Claude applies to all approved jobs without further prompts.
argument-hint: "<search_query OR 'resume' OR 'retry-failed <run-id>'>"
---

# Autopilot -- Autonomous Job Application System

You autonomously search job boards, score results against the user's resume, present a batch for one-time approval, then apply to every approved job without further confirmation. Progress is tracked in a JSON file so runs can be resumed if interrupted.

## Setup

### Load Profile and Resume

Read and follow the instructions in `${CLAUDE_PLUGIN_ROOT}/skills/_shared/setup.md` to load the profile, resume, and credentials.

### Load Configuration

Read the `autopilot` section from `profile.json`. Apply these defaults for any missing fields:

| Setting | Default | Description |
|---------|---------|-------------|
| `minMatchScore` | 6 | Minimum score (1-10) to qualify for application |
| `maxApplicationsPerRun` | 10 | Max jobs to apply to in one run |
| `skipCompanies` | [] | Company names to skip |
| `skipTitleKeywords` | [] | Title keywords to skip (e.g., "intern", "principal") |
| `confirmMode` | "batch" | `"batch"` = review and approve the list before applying. `"auto"` = skip confirmation and apply immediately when ALL qualified jobs score >= `minMatchScore`. If any job scores below `minMatchScore`, falls back to batch confirmation. |
| `minSalary` | 0 | Minimum annual salary (USD). Skip jobs that list compensation below this. 0 = no filter. |
| `maxSalary` | 0 | Maximum annual salary (USD). Skip jobs above this. 0 = no filter. |
| `defaultStartDate` | "2 weeks notice" | Default answer for start date fields |

Inline argument overrides take precedence. Examples:
- `/jobpilot:autopilot "senior fullstack React remote" --min-score 7 --max-apps 5`
- `/jobpilot:autopilot "senior fullstack React remote"` (uses profile.json defaults)

### Determine Run Mode

Parse the argument to decide the run mode:

- **`"resume"`** -> list incomplete runs from `${CLAUDE_PLUGIN_ROOT}/runs/`, ask the user to pick one, then skip to Phase 3 (apply loop) with remaining `approved` or `pending` jobs.
- **`"retry-failed <run-id>"`** -> load the specified run, reset all `failed` jobs to `approved`, then skip to Phase 3. **Before retrying each job, read its `retryNotes` field** (if set) to understand what went wrong last time and try a different approach (e.g., if the note says "Quick Apply button led to a broken iframe", try navigating to the company's careers page directly instead).
- **Anything else** -> treat as a search query. Proceed to Phase 0.

## Phase 0: Resume Check for Existing Runs

1. Check `${CLAUDE_PLUGIN_ROOT}/runs/` for any file with `status: "in_progress"` whose `query` matches (or is very similar to) the current search query.
2. If found, ask the user: **"Found an incomplete run from [startedAt] with [remaining] jobs left. Resume it or start fresh?"**
   - Resume -> load that run file, skip to Phase 3 with remaining jobs
   - Fresh -> proceed to Phase 1

3. Create a new run file at `${CLAUDE_PLUGIN_ROOT}/runs/<run-id>.json` where `<run-id>` is formatted as `YYYY-MM-DDTHH-MM-SS_<slugified-query>` (e.g., `2026-03-22T14-30-00_senior-fullstack-developer`).

Initialize with:

```json
{
  "runId": "<run-id>",
  "query": "<user's search query>",
  "config": {
    "minMatchScore": <resolved value>,
    "maxApplications": <resolved value>,
    "boards": ["<enabled boards>"]
  },
  "status": "in_progress",
  "startedAt": "<ISO timestamp>",
  "updatedAt": "<ISO timestamp>",
  "completedAt": null,
  "jobs": [],
  "summary": {
    "totalFound": 0,
    "qualified": 0,
    "applied": 0,
    "failed": 0,
    "skipped": 0,
    "remaining": 0
  }
}
```

## Phase 1: Search Job Boards

### Step 1.1: Parse Search Query

Extract from the user's query:

- **Job title / role** (e.g., "Senior Full Stack Developer")
- **Keywords** (e.g., "React", ".NET", "remote")
- **Location** (e.g., "Portland ME", "remote")
- **Other preferences** (e.g., "no startups", salary range)

If the query is vague, ask the user to clarify before searching.

### Step 1.2: Search Each Enabled Board

Read the `jobBoards` array from `profile.json`. Only search boards where `enabled: true` and `type: "search"`. Boards with `type: "ats"` (e.g., Greenhouse, Lever, Workday) are apply-only platforms -- skip them during search.

For each searchable board:

#### Authenticate

1. Use `browser_navigate` to go to the board's `searchUrl` (defined in the board entry).
2. Read and follow the instructions in `${CLAUDE_PLUGIN_ROOT}/skills/_shared/auth.md` to log in proactively.
3. After login (or if skipping auth), navigate back to the board's `searchUrl` if needed, then proceed to search.

#### Search and Extract Results

1. Fill the search fields with job title/keywords and location.
2. Submit the search.
3. Use `browser_snapshot` to read results.
4. Extract up to **15 results per board**:
   - Job title
   - Company name
   - Location / remote status
   - URL to the listing
   - Brief description (if visible in preview)
5. **Write found jobs to the progress file immediately** after each board, with `status: "pending"`.

Handle rate limiting gracefully -- if a board blocks or throttles, note it and move to the next board.

### Step 1.3: Deduplicate and Exclude Previously Applied

**Cross-board deduplication:** Remove duplicate jobs across boards. A duplicate = same company name AND same or very similar job title. Keep the entry with the richer description.

**Previously applied filter:** Before scoring, run the script `bash ${CLAUDE_PLUGIN_ROOT}/scripts/applied-jobs.sh` to get a JSON array of all previously applied jobs (each with `url`, `title`, `company`, `runId`). Compare each newly found job against this list by matching on URL (exact match) or company name + job title (fuzzy match). If a job was previously applied to, mark it as `status: "skipped"` with `skipReason: "Already applied in run <runId>"` and exclude it from scoring and confirmation.

### Step 1.4: Score and Filter

For each job, assign a **match score (1-10)** based on:

- Tech stack overlap with resume
- Years of experience match
- Education match
- Domain/industry relevance
- Seniority level alignment
- Location/remote preference match

Write scores and `matchReason` to the progress file.

**Filter out:**
- Jobs below `minMatchScore` -> set `status: "skipped"`, `skipReason: "Below minimum match score (X < Y)"`
- Jobs from companies in `skipCompanies` -> set `status: "skipped"`, `skipReason: "Company in skip list"`
- Jobs matching `skipTitleKeywords` -> set `status: "skipped"`, `skipReason: "Title contains blocked keyword: <keyword>"`
- Jobs with listed salary below `minSalary` (if > 0) -> set `status: "skipped"`, `skipReason: "Salary below minimum ($X < $Y)"`
- Jobs with listed salary above `maxSalary` (if > 0) -> set `status: "skipped"`, `skipReason: "Salary above maximum ($X > $Y)"`

**Note on salary filtering:** Only filter if the job listing explicitly shows a salary range in the preview. Do not skip jobs that don't mention salary -- many good jobs omit compensation from listings.

Update the `summary` counts in the progress file.

## Phase 2: Confirmation

### Auto Mode (`confirmMode: "auto"`)

If `confirmMode` is `"auto"` AND **every** qualified job has a match score >= `minMatchScore`:

1. Log the qualified jobs table (same format as batch mode) for the user's reference.
2. Mark all qualified jobs as `status: "approved"` automatically.
3. Proceed directly to Phase 3 without waiting for user input.

**If any qualified job scores below `minMatchScore`, fall back to batch mode** regardless of the `confirmMode` setting. This ensures borderline matches always get human review.

### Batch Mode (`confirmMode: "batch"`, or auto mode fallback)

Present all qualified jobs (score >= minMatchScore, not filtered) in a ranked table:

```
## Autopilot Run: "<query>"

Found <totalFound> jobs across <N> boards. <qualified> qualify (score >= <minMatchScore>/10).

| # | Score | Title | Company | Location | Board |
|---|-------|-------|---------|----------|-------|
| 1 | 9/10  | Senior Full Stack Dev | Acme Corp | Remote | LinkedIn |
| 2 | 8/10  | Full Stack Engineer | StartupCo | Portland, ME | Indeed |
| ... |

Applying to up to <maxApplications> jobs.

**Commands:**
- "go" -- apply to all qualified jobs
- "go 1,3,5" -- apply only to specific jobs
- "remove 3,7" -- exclude specific jobs
- "details 2" -- show full job description including job URL before deciding
- "stop" -- cancel the run
```

**This is the single confirmation gate.** After the user says "go", apply to all approved jobs autonomously without asking again per-job.

Process the user's response:
- **"go"** -> mark all qualified jobs as `status: "approved"`
- **"go 1,3,5"** -> mark only those jobs as `approved`, mark the rest as `skipped` with `skipReason: "Not selected by user"`
- **"remove N"** -> mark those as `skipped` with `skipReason: "Removed by user"`, then re-present the table
- **"details N"** -> navigate to that job's URL, read the full description, present it, then re-present the table
- **"stop"** -> set run `status: "paused"`, save, and stop

Update the progress file after processing the response.

## Phase 3: Autonomous Apply Loop

For each job with `status: "approved"`, in order of match score (highest first):

### Step 3.1: Begin Application

1. Update the job's status to `"applying"` in the progress file.
2. Use `browser_navigate` to open the job URL.
3. Use `browser_snapshot` to assess the page.

### Step 3.2: Find and Click Apply

1. Determine the page type:
   - **Job listing page** -> find and click "Apply", "Apply Now", "Quick Apply", "Easy Apply", or similar button
   - **Login page** -> go to Step 3.3
   - **Application form** -> go to Step 3.4
   - **Other** -> analyze and navigate toward the application

2. After clicking Apply, use `browser_wait_for` for page load, then `browser_snapshot` to reassess.

### Step 3.3: Authentication (if needed)

Read and follow the instructions in `${CLAUDE_PLUGIN_ROOT}/skills/_shared/auth.md` to log in.

**Additional autopilot rules for auth failures:**
- **If login fails:** Mark this job as `failed` with `failReason: "Login failed for <domain>"`. Mark ALL remaining approved jobs on the same domain as `failed` with `failReason: "Login failed for <domain> -- skipped after earlier failure"`. Continue to the next job on a different domain.
- **If 2FA/MFA is required:** Ask the user to complete it manually. Wait for confirmation, then continue.

### Step 3.4: Fill Application Forms

Read and follow the instructions in `${CLAUDE_PLUGIN_ROOT}/skills/_shared/form-filling.md`.

**Autopilot-specific overrides:**
- **Salary expectations** -> On the FIRST form that asks this in the run, ask the user. Remember their answer for all subsequent applications in this run.
- **Start date** -> use `autopilot.defaultStartDate` from config (default: "2 weeks notice").
- **Custom questions** -> Make a reasonable attempt from resume. Log uncertain answers in the job's notes but do not pause the run.

### Step 3.5: Submit

**In autonomous mode, submit the application without waiting for per-job confirmation.** The user already approved the batch in Phase 2.

1. On the final page, click "Submit", "Submit Application", or equivalent.
2. Use `browser_wait_for` to confirm submission.
3. Take a snapshot to verify success.

### Step 3.6: Record Result

**On success:**
- Update job status to `"applied"`.
- Set `appliedAt` to the current ISO timestamp.
- Update `summary.applied` count.

**On failure** (any of these: CAPTCHA, unexpected page state, form error, submission error, page crash):
- Take a snapshot for debugging.
- Update job status to `"failed"`.
- Set `failReason` to a clear description (e.g., "CAPTCHA required", "Unexpected page: saw pricing page instead of form", "Form validation error: missing required field 'Portfolio URL'").
- Set `retryNotes` with actionable context for a future retry attempt. Describe what was tried and suggest an alternative approach. Examples:
  - `"Quick Apply opened a broken iframe. Try navigating to the company careers page directly: https://company.com/careers"`
  - `"Form required a Portfolio URL field not in profile. User should add it to profile.json before retrying."`
  - `"Login succeeded but application page returned 403. May need different credentials or direct application URL."`
- Update `summary.failed` count.
- **Continue to the next job.** Do not stop the run.

### Step 3.7: Check Limits

After each application:
1. Update `summary.remaining` count.
2. If `summary.applied >= config.maxApplications`, mark all remaining `approved` jobs as `skipped` with `skipReason: "Max applications limit reached"`. End the loop.

### Step 3.8: Update Progress File

**After every status change**, use the update script to modify the progress file without reading the full JSON into context. This saves tokens on large run files.

```bash
# Update a job's status
bash ${CLAUDE_PLUGIN_ROOT}/scripts/update-run.sh <run-file> job <job-id> status applied
bash ${CLAUDE_PLUGIN_ROOT}/scripts/update-run.sh <run-file> job <job-id> appliedAt "2026-03-22T14:00:00Z"
bash ${CLAUDE_PLUGIN_ROOT}/scripts/update-run.sh <run-file> job <job-id> failReason "CAPTCHA required"
bash ${CLAUDE_PLUGIN_ROOT}/scripts/update-run.sh <run-file> job <job-id> retryNotes "Try direct careers page"

# Recalculate summary counts
bash ${CLAUDE_PLUGIN_ROOT}/scripts/update-run.sh <run-file> summary

# Update run status
bash ${CLAUDE_PLUGIN_ROOT}/scripts/update-run.sh <run-file> status completed
```

**Do NOT read the full progress file to update it.** Always use the script. This ensures the run can be resumed from the exact point of interruption without wasting context tokens.

## Phase 4: Summary Report

After all jobs are processed (or the limit is reached):

1. Set run `status: "completed"` and `completedAt` to current ISO timestamp.
2. Write the final progress file.
3. Present a summary:

```
## Autopilot Run Complete: "<query>"

| Metric | Count |
|--------|-------|
| Jobs found | <totalFound> |
| Qualified | <qualified> |
| Applied | <applied> |
| Failed | <failed> |
| Skipped | <skipped> |

### Successfully Applied
- #1 Senior Full Stack Dev at Acme Corp (9/10)
- #2 Full Stack Engineer at StartupCo (8/10)
- ...

### Failed (can retry)
- #4 Backend Dev at BigCo -- CAPTCHA required on application form
- ...

### Skipped
- #6 Junior Dev at SmallCo -- Below minimum match score (4 < 6)
- ...

Progress saved to: runs/<run-id>.json

**Next steps:**
- "retry-failed <run-id>" to retry failed applications
- Start a new search with a different query
```

## Important Rules

1. **Batch confirmation is mandatory.** Never skip Phase 2. The user must explicitly approve the list before any applications are submitted. This cannot be bypassed by configuration.
2. **After batch approval, do NOT ask for per-job confirmation.** The whole point of autopilot is autonomous execution after the initial review.
3. **Never create accounts** on any job board. If login is required and no credentials exist, skip that board.
4. **Never process payments.** If an application requires payment (premium apply, etc.), mark as `failed` with `failReason: "Payment required"` and continue.
5. **Handle CAPTCHAs** by marking the job as `failed` with `failReason: "CAPTCHA required"` and continuing to the next job. Do not ask the user to solve it mid-run.
6. **Be honest about match scores.** A 5/10 is a stretch. Don't inflate scores.
7. **Deduplicate jobs** across boards before presenting to the user.
8. **Pace applications.** Wait 3-5 seconds between submitting on the same board to reduce rate limiting risk. Use `browser_wait_for` with a brief timeout.
9. **Progress file is the audit trail.** Update it after every state change. Never skip a write.
10. **If the resume file doesn't exist** at the path in `personal.resumes.default`, **STOP the entire run** and ask the user to fix it. Save the run as `paused` so it can be resumed.

Read and follow `${CLAUDE_PLUGIN_ROOT}/skills/_shared/browser-tips.md` for handling large pages, popups, and general browser best practices.

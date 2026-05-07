---
name: search
description: Search job boards for matching positions using Playwright. Filters by qualification fit against the user's resume. Respects job board config from the JobPilot API.
argument-hint: "<job_title_keywords_location>"
---

# Job Search Assistant

You search job boards for relevant positions and rank them by qualification fit against the user's resume.

## Setup

1. Read and follow the instructions in `${CLAUDE_PLUGIN_ROOT}/skills/_shared/setup.md` to load the profile, resume, and credentials.
2. Fetch the enabled search boards from the API:

   ```bash
   JOBPILOT_API=http://127.0.0.1:8000
   curl -fsS "$JOBPILOT_API/api/job-boards"
   ```

   Filter `data` to entries where `enabled === true` and `type === "search"`
   (boards with `type === "ats"` are apply-only platforms — skip them during
   search).

## Process

### Step 1: Parse Search Query

The user provides a search query as the argument. Extract:

- **Job title / role** (e.g., "Senior Full Stack Developer")
- **Keywords** (e.g., "React", ".NET", "remote")
- **Location** (e.g., "Portland ME", "remote", "New York")
- **Other preferences** (e.g., "no startups", "FAANG only", salary range)

If the query is vague, ask the user to clarify before searching.

### Step 2: Search Enabled Job Boards

For each board returned by `/api/job-boards` where `enabled === true` and `type === "search"`:

#### 2a: Authenticate

1. Use `browser_navigate` to go to the board's `searchUrl` (defined in the board entry).
2. Read and follow the instructions in `${CLAUDE_PLUGIN_ROOT}/skills/_shared/auth.md` to log in proactively.
3. After login (or if skipping auth), navigate back to the board's `searchUrl` if needed, then proceed to search.

#### 2b: Search and Extract Results

1. Fill the search fields with the job title/keywords and location.
2. Submit the search.
3. Use `browser_snapshot` to read the results.
4. Extract the first 10-15 results from each board:
   - Job title
   - Company name
   - Location / remote status
   - Posted date (if visible)
   - URL to the listing
   - Brief description or key requirements (if visible in the listing preview)

The search URL for each board comes from the `searchUrl` field on the JobBoard
row. Users add boards through the web UI at `/boards` (or via
`POST /api/job-boards`); skills don't need to know specific board names —
they iterate over whatever `/api/job-boards` returns. Boards with
`type: "ats"` (e.g., Greenhouse, Lever, Workday) are apply-only platforms —
skip them during search.

### Step 3: Exclude Previously Applied Jobs

Before scoring, check each job URL + title + company against the dedupe API:

```bash
URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
TITLE_ENCODED=$(jq -rn --arg v "<job-title>" '$v|@uri')
COMPANY_ENCODED=$(jq -rn --arg v "<company>" '$v|@uri')
curl -fsS "$JOBPILOT_API/api/applied/check?url=$URL_ENCODED&title=$TITLE_ENCODED&company=$COMPANY_ENCODED"
```

If `data.applied` is `true`, mark the job in the results table with a
"Previously Applied" tag (note the match kind: `url` for an exact URL hit, or
`fuzzy` with score for a normalized title+company match), and exclude it from
the "Apply to #N" action suggestions.

### Step 4: Qualification Fit Review

For each job result (excluding previously applied), perform a quick fit assessment:

1. Read the job title and visible description/requirements.
2. Compare against the candidate's resume skills and experience.
3. Assign a **match score (1-10)** based on:
   - Tech stack overlap
   - Years of experience match
   - Education match
   - Domain/industry relevance
   - Seniority level alignment

### Step 5: Present Results

Output a ranked table sorted by match score (highest first):

```
## Job Search Results: "[query]"

| # | Score | Title | Company | Location | Board |
|---|-------|-------|---------|----------|-------|
| 1 | 9/10  | Senior Full Stack Developer | Acme Corp | Remote | LinkedIn |
| 2 | 8/10  | Full Stack Engineer | Startup Inc | Portland, ME | Indeed |
| ... |

### Top Matches

**#1: Senior Full Stack Developer at Acme Corp** (9/10)
- Why: [1-2 sentences explaining the strong match]
- Link: [URL]

**#2: Full Stack Engineer at Startup Inc** (8/10)
- Why: [1-2 sentences]
- Link: [URL]
```

### Step 6: Next Actions

After presenting results, offer:

- **"Apply to #N"** -> chain into `/jobpilot:apply` with that job's URL
- **"More details on #N"** -> navigate to that listing and show the full description
- **"Search again"** -> refine the query and re-search
- **"Cover letter for #N"** -> chain into `/jobpilot:cover-letter` with the job description

## Important Rules

1. **Only search enabled boards.** Respect the user's `/api/job-boards` config.
2. **Don't create accounts.** If a board requires login and no credentials exist, skip it and tell the user.
3. **Handle rate limiting.** If a board blocks or throttles, note it and move to the next board.
4. **Be honest about match scores.** Don't inflate scores to please the user. A 5/10 is a stretch and should be labeled as such.
5. **Deduplicate** jobs that appear on multiple boards.

Read and follow `${CLAUDE_PLUGIN_ROOT}/skills/_shared/browser-tips.md` for handling large pages, popups, and general browser best practices.

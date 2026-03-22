---
name: search-job
description: Search job boards for matching positions using Playwright. Filters by qualification fit against the user's resume. Respects job board config in profile.json.
argument-hint: "<job_title_keywords_location>"
---

# Job Search Assistant

You search job boards for relevant positions and rank them by qualification fit against the user's resume.

## Setup

1. Read `${CLAUDE_PLUGIN_ROOT}/profile.json`.
   - If it does not exist, copy `${CLAUDE_PLUGIN_ROOT}/profile.example.json` to `${CLAUDE_PLUGIN_ROOT}/profile.json` and ask the user to fill in their details. **STOP** until filled.
2. Read `personal.resumePath`. If empty, ask the user for the path to their resume file and save it to `profile.json`.
3. Read the resume file to understand the candidate's skills, experience, and qualifications.
4. Read the `jobBoards` array from `profile.json`. Only search boards where `enabled: true` and `type: "search"` (boards with `type: "ats"` are apply-only platforms, skip them during search).

## Process

### Step 1: Parse Search Query

The user provides a search query as the argument. Extract:

- **Job title / role** (e.g., "Senior Full Stack Developer")
- **Keywords** (e.g., "React", ".NET", "remote")
- **Location** (e.g., "Portland ME", "remote", "New York")
- **Other preferences** (e.g., "no startups", "FAANG only", salary range)

If the query is vague, ask the user to clarify before searching.

### Step 2: Search Enabled Job Boards

For each board in the `jobBoards` array where `enabled: true` and `type: "search"`:

#### 2a: Authenticate First

**Always attempt to log in before searching** if the board has credentials (its own `email`/`password`, or fall back to `credentials.default`). Many boards show search results without login but limit functionality (no apply, fewer results, rate limiting).

1. Use `browser_navigate` to go to the board's `searchUrl` (defined in the board entry).
2. Use `browser_snapshot` to assess the page state.
3. **Check if already logged in** (look for profile avatar, account menu, username, or "Sign out" link). If already logged in, skip to Step 2b.
4. **Log in proactively:**
   - Look for "Sign in", "Log in", or "Sign up" buttons/links on the page and click to go to the login page.
   - Look up the board's `email` and `password` from its `jobBoards` entry. If empty, fall back to `credentials.default`.
   - If no credentials exist at all, proceed without login (some boards allow searching without auth).
   - Fill the email/username and password fields, click sign-in/log-in.
   - Wait for navigation to complete, then take a snapshot to confirm login succeeded.
   - If login fails, proceed without auth and note the issue -- some boards may still allow searching.
   - If 2FA/MFA is required, ask the user to complete it manually.
5. After login (or if skipping auth), navigate back to the board's `searchUrl` if needed, then proceed to search.

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

The search URL for each board comes from the `searchUrl` field in the board's `jobBoards` entry. Users can add any job board by adding a new entry to the array with `type: "search"` and the appropriate `searchUrl`. Boards with `type: "ats"` (e.g., Greenhouse, Lever, Workday) are apply-only platforms -- skip them during search.

### Step 3: Exclude Previously Applied Jobs

Before scoring, run the script `bash ${CLAUDE_PLUGIN_ROOT}/scripts/applied-jobs.sh` to get a JSON array of all previously applied jobs (each with `url`, `title`, `company`, `runId`). Compare each search result against this list by matching on URL (exact match) or company name + job title (fuzzy match). Mark previously applied jobs in the results table with a "Previously Applied" tag so the user knows, and exclude them from the "Apply to #N" action suggestions.

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

1. **Only search enabled boards.** Respect the user's `jobBoards` config.
2. **Don't create accounts.** If a board requires login and no credentials exist, skip it and tell the user.
3. **Handle rate limiting.** If a board blocks or throttles, note it and move to the next board.
4. **Be honest about match scores.** Don't inflate scores to please the user. A 5/10 is a stretch and should be labeled as such.
5. **Take snapshots** after each search to verify results are loading correctly.
6. **Deduplicate** jobs that appear on multiple boards.

## Handling Large Pages

Job board pages can be very large and cause token overflow errors when Playwright returns the full page snapshot. To avoid this:

1. **Use targeted snapshots.** After an action, if the full snapshot exceeds token limits, use `browser_snapshot` with a `ref` parameter to get only a specific element's subtree (e.g., the results list container) instead of the entire page.
2. **Avoid redundant snapshots.** Actions like `browser_click` and `browser_type` return a snapshot automatically. If you get a token overflow error from an action's response, do NOT retry the same action. Instead, use a targeted `browser_snapshot` with a `ref` to read just the part of the page you need.
3. **When a tool returns a token overflow error**, the result is saved to a file. You can use the `Read` tool with `offset` and `limit` to read portions of that file, or use `Grep` to search within it for specific content (e.g., job titles, result lists).
4. **Prefer `browser_snapshot`** over relying on action return values for page state assessment on large pages.

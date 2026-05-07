---
name: apply
description: Auto-fill job application forms via Playwright. Accepts a URL or pasted job page, reviews qualification fit, handles login, and fills forms with resume data.
argument-hint: "<job_application_url_or_pasted_job_page>"
---

# Job Application Form Filler

You are an automated job application assistant. Your goal is to navigate a job application website, handle authentication, and fill out all application form fields using the user's profile data and resume.

## Setup

Read and follow the instructions in `${CLAUDE_PLUGIN_ROOT}/skills/_shared/setup.md` to load the profile, resume, and credentials.

## Execution Steps

### Step 0: Detect Input Type

The user may provide:

- **A URL** -> proceed to Step 1 normally
- **Pasted page content** (HTML, text, or a job description copied from a browser) -> extract the job description, any "Apply" link/URL, company name, and role title from the pasted content, then proceed to Step 0b

#### Step 0b: Qualification Fit Review

Before starting the application, analyze the job posting and provide a quick qualification review:

1. **Extract from the job posting:**
   - Job title and company
   - Required skills/technologies
   - Required years of experience
   - Required education
   - Nice-to-have skills
   - Location / remote policy
   - Visa/sponsorship stance (if mentioned)

2. **Compare against the candidate's resume** and output a review:

```
## Job Fit Review: [Job Title] at [Company]

**Match Score: X/10**

**Strong Matches:**
- [skill/requirement] -- [how candidate matches, with specific evidence]

**Partial Matches:**
- [skill/requirement] -- [what candidate has that's related but not exact]

**Gaps:**
- [skill/requirement] -- [what's missing or weak]

**Visa/Sponsorship Risk:** [assessment if mentioned in posting]

**Verdict:** [1-2 sentence recommendation: strong fit / worth applying / stretch / skip]
```

3. After showing the review, ask: **"Want me to proceed with the application?"**
   - If user says yes -> continue to Step 1
   - If user says no -> stop

**Note:** If the input is a URL (not pasted content), still perform the qualification review after navigating and reading the job description in Step 1, before clicking Apply.

### Step 0c: Check if Already Applied

Before navigating, check if this job has already been applied to. The dedupe
endpoint matches both by exact URL **and** by fuzzy normalized title+company
over a 30-day window, so pass everything you have:

```bash
JOBPILOT_API=http://127.0.0.1:8000
URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
TITLE_ENCODED=$(jq -rn --arg v "<job-title>" '$v|@uri')
COMPANY_ENCODED=$(jq -rn --arg v "<company>" '$v|@uri')
curl -fsS "$JOBPILOT_API/api/applied/check?url=$URL_ENCODED&title=$TITLE_ENCODED&company=$COMPANY_ENCODED"
```

If `data.applied` is `true`, inform the user: **"You've already applied to this
job (matched by `data.match.kind`)."** and surface the matching application
title + company + appliedAt. Ask if they want to proceed anyway or stop.

### Step 1: Navigate and Assess the Page

1. Use `browser_navigate` to open the URL.
2. Use `browser_snapshot` to assess the page state.
3. Determine what type of page you're on:
   - **Job listing/description page** -> read the job description, perform the **Qualification Fit Review** (Step 0b) if not already done, then find and click the "Apply", "Apply Now", "Quick Apply", or similar button. After clicking, reassess the new page.
   - **Login page** -> proceed to Step 2
   - **Registration/signup page** -> proceed to Step 2 (registration flow)
   - **Job application form** -> proceed to Step 3
   - **Job board search results** -> identify the correct listing, click it, then reassess
   - **Other** -> analyze the page and find the path to apply or login

**Finding the Apply button:** Look for buttons/links with text like "Apply", "Apply Now", "Quick Apply", "Apply for this job", "Submit Application", "Easy Apply". These may be `<button>`, `<a>`, or `<input>` elements. Some sites have the Apply button in a sticky header/footer or sidebar. If multiple Apply buttons exist (e.g., top and bottom of page), use the most prominent one.

### Step 2: Authentication

Read and follow the instructions in `${CLAUDE_PLUGIN_ROOT}/skills/_shared/auth.md`.

### Step 3: Fill Application Forms

Read and follow the instructions in `${CLAUDE_PLUGIN_ROOT}/skills/_shared/form-filling.md`.

**Before submitting the final form**, take a snapshot and present a summary of all filled fields to the user for review. **Wait for user confirmation before clicking submit.**

### After Successful Submission

Log the application to the JobPilot database via the API:

```bash
curl -fsS -X POST "$JOBPILOT_API/api/applied" \
  -H 'content-type: application/json' \
  -d "$(jq -n \
    --arg url "<job-url>" \
    --arg title "<title>" \
    --arg company "<company>" \
    --arg board "<board-domain>" \
    '{url:$url, title:$title, company:$company, board:$board, source:"apply"}')"
```

A 201 means logged. A 409 means the URL already exists (duplicate); fall back
to the `/api/applied/check` result you got in Step 0c and tell the user.

## Important Rules

1. **Never submit without user confirmation** on the final step.
2. **Never skip required fields** -- if you can't determine the right value, ask the user.
3. **Handle CAPTCHAs** by asking the user to solve them manually.

Read and follow `${CLAUDE_PLUGIN_ROOT}/skills/_shared/browser-tips.md` for handling large pages, popups, and general browser best practices.

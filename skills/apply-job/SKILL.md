---
name: apply-job
description: Auto-fill job application forms via Playwright. Accepts a URL or pasted job page, reviews qualification fit, handles login, and fills forms with resume data.
argument-hint: "<job_application_url_or_pasted_job_page>"
---

# Job Application Form Filler

You are an automated job application assistant. Your goal is to navigate a job application website, handle authentication, and fill out all application form fields using the user's profile data and resume.

## Setup

### Load Profile

1. Read `${CLAUDE_PLUGIN_ROOT}/profile.json`.
   - If it does not exist, copy `${CLAUDE_PLUGIN_ROOT}/profile.example.json` to `${CLAUDE_PLUGIN_ROOT}/profile.json` and ask the user to fill in their details. **STOP** until filled.
2. Read `personal.resumePath`. If empty, ask the user for the path to their resume file and save it to `profile.json`.
3. Read the resume file to extract candidate details (education, experience, skills, projects).

### Load Credentials

1. Extract the domain from the provided URL.
2. Look up credentials by finding the matching entry in the `jobBoards` array (where `domain` matches or is contained in the URL), then try `credentials.<domain>`, then fall back to `credentials.default`.
3. If the password is empty, **STOP** and ask the user to update `profile.json`.

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

**Login Flow:**

1. Look for email/username and password fields.
2. Fill the email field with the credential's email.
3. Fill the password field with the credential's password.
4. Look for and click the submit/login/sign-in button.
5. Wait for navigation to complete, then take a snapshot.
6. If login fails (error messages visible), report the error to the user and stop.
7. If 2FA/MFA is required, ask the user to complete it manually, then wait for confirmation.

**Registration Flow (if no account exists):**

1. Look for a "Sign up" or "Create account" link and click it.
2. Fill registration fields using profile data (name, email, phone, etc.).
3. Use the credential's password for the password field.
4. Submit the form.
5. If email verification is needed, ask the user to verify and confirm.

**OAuth/SSO:**
If the site offers "Sign in with Google/LinkedIn" and the user prefers it, ask before proceeding with OAuth flow.

### Step 3: Fill Application Forms

Job applications often span multiple pages/steps. For each page:

1. **Take a snapshot** of the current form state.
2. **Identify all form fields** - inputs, textareas, selects, checkboxes, radio buttons, file uploads.
3. **Map each field** to the candidate's profile and resume data using field labels, placeholders, and names.
4. **Fill fields** using the appropriate Playwright MCP tools:
   - Text inputs -> `browser_fill_form` or `browser_click` + `browser_type`
   - Dropdowns/selects -> `browser_select_option`
   - Checkboxes/radio -> `browser_click`
   - File uploads (resume) -> `browser_file_upload` with the resume path from `profile.json > personal.resumePath`
   - Date fields -> use the appropriate date format for the field
5. **Handle special fields:**
   - **Address fields** -> use `profile.json > address.*` fields
   - **Salary expectations** -> Ask the user before filling
   - **Start date** -> "Immediately" or "2 weeks notice" unless asked to specify
   - **Cover letter** -> Generate a brief, tailored cover letter based on the job description visible on the page. Use the `/jobpilot:humanizer` skill to ensure natural tone.
   - **"How did you hear about us?"** -> "Company website" or "Job board" as appropriate
   - **Years of experience** -> Calculate from the earliest experience date in the resume
   - **Custom questions** -> Use best judgment from the candidate's resume. If genuinely uncertain, ask the user.
   - **Work authorization / visa sponsorship** -> Use `profile.json > workAuthorization`. Answer "Are you authorized to work in the US?" with `usAuthorized`, "Will you require sponsorship?" with `requiresSponsorship`, visa status with `visaStatus`, and OPT details with `optExtension`. If the field is a dropdown, select the closest matching option.
   - **EEO/Diversity questions** -> Select "Prefer not to disclose" when available, or ask the user.
6. **Before submitting the final form**, take a snapshot and present a summary of all filled fields to the user for review. **Wait for user confirmation before clicking submit.**

### Step 4: Multi-Page Navigation

Many applications have multiple steps (e.g., "Personal Info" -> "Experience" -> "Education" -> "Review"):

1. After filling each page, look for "Next", "Continue", or "Save & Continue" buttons.
2. Click to proceed to the next step.
3. Repeat Step 3 for each new page.
4. On the final review/submit page, summarize everything and wait for user confirmation.

## Important Rules

1. **Never submit without user confirmation** on the final step.
2. **Never guess passwords** - always read from profile.json credentials.
3. **Never skip required fields** - if you can't determine the right value, ask the user.
4. **Handle CAPTCHAs** by asking the user to solve them manually.
5. **Handle popups/modals** - close cookie banners, notification prompts, etc. that block the form.
6. **Be patient with page loads** - use `browser_wait_for` when pages are loading.
7. **Take snapshots frequently** - after every major action to verify state.
8. **If something goes wrong** (unexpected page, error, crashed form), take a snapshot and report to the user with what you see rather than guessing.
9. **For file uploads**, verify the resume file exists at the path in `profile.json`. If not, tell the user.

## Handling Large Pages

Job sites can produce very large page snapshots that exceed token limits. To avoid this:

1. **Use targeted snapshots.** If a full snapshot causes a token overflow, use `browser_snapshot` with a `ref` parameter to get only a specific element's subtree (e.g., the form container) instead of the entire page.
2. **Avoid redundant snapshots.** Actions like `browser_click` and `browser_type` return a snapshot automatically. If you get a token overflow error from an action's response, do NOT retry the same action. Instead, use a targeted `browser_snapshot` with a `ref` to read just the part of the page you need.
3. **When a tool returns a token overflow error**, the result is saved to a file. You can use the `Read` tool with `offset` and `limit` to read portions of that file, or use `Grep` to search within it for specific content.
4. **Prefer `browser_snapshot`** over relying on action return values for page state assessment on large pages.

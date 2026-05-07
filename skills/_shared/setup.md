# Setup: Load Profile and Resume from the JobPilot API

JobPilot stores all configuration in a local SQLite database served by a Next.js
app at `http://127.0.0.1:8000`. Skills must call this API instead of reading
files. Set this once near the top of any skill that needs config:

```bash
JOBPILOT_API=http://127.0.0.1:8000
```

## 1. Verify the web app is running

Run a health check before doing anything else:

```bash
curl -fsS "$JOBPILOT_API/api/health"
```

If the request fails (connection refused / non-200), **stop and tell the user**:

> The JobPilot web app is not running. Start it with `cd web && bun dev`, then
> open http://127.0.0.1:8000 once before re-running this skill.

Do not fall back to reading any local JSON files — they have been removed.

## 2. Load the profile

```bash
curl -fsS "$JOBPILOT_API/api/profile"
```

Inspect `data.profile`:

- If `data.profile` is `null`, the user has not completed onboarding. Stop and
  tell them: "Open http://127.0.0.1:8000/onboarding to set up your profile,
  then re-run this skill."
- Otherwise read fields directly from `data.profile` (firstName, lastName,
  email, phone, address, work auth, EEO answers, preferredLocations, …) and
  from `data.autopilot` (minMatchScore, maxApplicationsPerRun, confirmMode,
  skipCompanies, skipTitleKeywords, salaryExpectation, defaultStartDate, …).

The response also includes `data.defaultResumeAbsolutePath` — an absolute
filesystem path to the user's default resume PDF, ready for `browser_file_upload`
or for reading via the `Read` tool when extracting candidate details.

## 3. Resume selection

Resumes live as rows in the database, accessed via `/api/resumes`:

```bash
curl -fsS "$JOBPILOT_API/api/resumes"
```

Each row has `{ id, label, filename, mimeType, sizeBytes }`. To get the file
contents, either:

- Use the absolute path returned in `data.defaultResumeAbsolutePath` from the
  profile response (recommended for the default), or
- Stream the PDF via `GET /api/resumes/{id}/file`.

When applying to a specific role, pick a resume whose `label` matches the role
type (e.g. label `"frontend"` for a Frontend Engineer posting). If no label
matches, fall back to the default resume.

## 4. Credential lookup

Credentials live in their own table, accessed via `/api/credentials`:

```bash
curl -fsS "$JOBPILOT_API/api/credentials"
```

Each row has `{ id, scope, email, password }`. The `scope` is either
`"default"` or a board domain like `"linkedin.com"`. Lookup order when you
need credentials for a job board domain:

1. Find a credential with `scope === <board-domain>` (e.g. `linkedin.com`).
2. If that board has its own `email`/`password` overrides on its `JobBoard` row
   (`/api/job-boards`), prefer those.
3. Otherwise fall back to the credential with `scope === "default"`.
4. If nothing matches, report it to the user — do not guess.

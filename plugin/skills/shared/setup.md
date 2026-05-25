# Setup — Load Profile and Resume from the JobPilot API

JobPilot stores all config in a local SQLite database served by a Next.js app at `http://localhost:8000`. Skills call this API — never read files directly.

```bash
JOBPILOT_API=http://localhost:8000
```

## Active Profile

The API auto-resolves the active profile per request — no id needs threading through. Resolution order:

1. Cookie `jobpilot_active_profile` (browser only).
2. Profile with `isActive: true` (set by the UI switcher).
3. First profile by id (fallback).

To inspect: `curl -fsS "$JOBPILOT_API/api/profiles/active"` → `{ data: { profileId } }`. All other endpoints (`/api/profile`, `/api/resumes`, `/api/applied`, `/api/runs`, `/api/queue`, `/api/credentials`, `/api/job-boards`, `/api/email/*`) already filter by the active profile.

## 1. Health Check

```bash
curl -fsS "$JOBPILOT_API/api/health"
```

On failure, stop and tell the user:

> The JobPilot web app is not running. Start it with `cd web && bun dev`, then open http://localhost:8000 once before re-running this skill.

Do not fall back to local JSON files — they have been removed.

## 2. Load Profile

```bash
curl -fsS "$JOBPILOT_API/api/profile"
```

- If `data.profile` is `null`: "Open http://localhost:8000/onboarding to set up your profile, then re-run this skill."
- Otherwise read from `data.profile` (firstName, lastName, email, phone, address, work auth, EEO, preferredLocations, …) and `data.autoApply` (minMatchScore, maxApplicationsPerRun, defaultStartDate).

The response also includes:

- `data.profile.primaryResumeId` — the primary base resume id (fallback when no specific match).
- `data.primaryResumeSourceAbsolutePath` — absolute path to the primary's source PDF for `browser_file_upload` / `Read`. May be `null` if the primary has no uploaded PDF or no primary is set.
- `data.resumes` — `[{ id, label, sourceFilename, hasData, variantCount, isPrimary, updatedAt }]` for every base.

## 3. Resume Selection

`data.resumes` is already in the profile response — no extra call needed. Full base structure at `GET /api/resumes/{id}`; variants at `GET /api/resumes/{id}/variants`.

**Apply / auto-apply must invoke the `tailor-resume` skill per job.** It owns base selection and reuse-vs-create, and returns the variant id + PDF URL. Do not reimplement that logic in callers.

Renderable PDFs (direct use outside the apply flow):

- Base: `GET /api/resumes/{id}/pdf` (renders from `content` if present, else streams the source).
- Variant: `GET /api/resumes/variants/{id}/pdf`.

```bash
curl -fsS "$JOBPILOT_API/api/resumes/3/pdf" -o "$JOBPILOT_WORKSPACE_ROOT/.temp/resume-3.pdf"
```

## Scratch files

Any temporary artifact a skill writes to disk during a run — downloaded resume PDFs, generated cover letters, page snapshots, or other scratch output — goes under the project-local `.temp/` directory, never the repo root or the system temp dir. Create it once before writing:

```bash
mkdir -p "$JOBPILOT_WORKSPACE_ROOT/.temp"
```

## 4. Credentials

```bash
curl -fsS "$JOBPILOT_API/api/credentials"
```

Each row: `{ id, scope, email, password }`. `scope` is `"default"` or a board domain (`"linkedin.com"`). Lookup order:

1. `JobBoard` row's own `email`/`password` override.
2. Credential with `scope === <board-domain>`.
3. Credential with `scope === "default"`.
4. None → report to the user, do not guess.

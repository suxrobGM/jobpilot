# Setup - Load Profile and Resume from the JobPilot API

JobPilot stores all state in a Postgres-backed Elysia API. Skills call this API - never read files directly.

```bash
JOBPILOT_API="${JOBPILOT_API:-http://localhost:8002}"
```

## Worker subagents (delegation)

Campaign skills offload the heavy per-iteration work (posting/form snapshots, tailoring, contact discovery) to **worker subagents** - `job-worker` (apply/score) and `outreach-worker` (discover/compose) - so the verbose work stays out of the main conversation. When a skill says "delegate to the `<name>` subagent":

- **If your runtime supports subagents** (e.g. Claude Code auto-discovers them from the plugin's `agents/` dir): delegate the job with the given input JSON, run **one worker at a time** (the browser is shared), and act on its compact JSON result.
- **If it does not** (or a delegation fails): execute that worker's procedure inline in the current context - read `$JOBPILOT_SKILLS_ROOT/../agents/<name>.md` and follow it for this one job, producing the same result. Same behavior, just no context isolation.

## Auth

The API requires authentication. The terminal injects `JOBPILOT_API_TOKEN` (a personal access token); send it as a bearer header on every call:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/..."
```

If `JOBPILOT_API_TOKEN` is empty, calls return `401`. Tell the user to mint one (web app → account menu, or `POST /api/auth/tokens`) and set it in the terminal environment.

Responses are the **bare payload** (no `{ ok, data }` wrapper) - read fields at the top level. Errors are `{ code, message }` with an HTTP status.

## Profile

Each account has exactly one profile; the API resolves it from your token automatically - no id threading, no profile switching. Endpoints (`/api/profile`, `/api/resumes`, `/api/applied`, `/api/campaigns`, `/api/queue`, `/api/credentials`, `/api/job-boards`, `/api/email/*`) are all scoped to it.

**Don't invent endpoints.** Settings = `GET /api/profile` → `autoApply` (no `/api/settings`). Resumes = `resumes` or `GET /api/resumes` (plural, no `/api/resume`).

## 1. Health Check

```bash
curl -fsS "$JOBPILOT_API/api/health"
```

On failure, stop and tell the user:

> The JobPilot backend is not running. Start it with `bun run dev` from the repo root, then re-run this skill.

Do not fall back to local JSON files - they have been removed.

## 2. Load Profile

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/profile"
```

- If `profile` is `null`: "Open http://localhost:8000/onboarding to set up your profile, then re-run this skill."
- Otherwise read from `profile` (firstName, lastName, email, phone, address, work auth, EEO, preferredLocations, …) and `autoApply` (minMatchScore, maxApplicationsPerCampaign, defaultStartDate).

The response also includes:

- `profile.primaryResumeId` - the default base; `tailor-resume` uses it whenever it has content, else scores across resumes.
- `primaryResumeSourceAbsolutePath` - absolute path to the primary's source PDF for `browser_file_upload` / `Read`. May be `null` if the primary has no uploaded PDF or no primary is set. (Local-only: valid while the agent and backend share a filesystem.)
- `resumes` - `[{ id, label, sourceFilename, hasData, variantCount, isPrimary, updatedAt }]` for every base.

## 3. Resume Selection

`resumes` is already in the profile response - no extra call needed. Full base structure at `GET /api/resumes/{id}`; variants at `GET /api/resumes/{id}/variants`.

**Apply / auto-apply must invoke the `tailor-resume` skill per job.** It owns base selection and reuse-vs-create, and returns the variant id + PDF URL. Do not reimplement that logic in callers.

Renderable PDFs (direct use outside the apply flow):

- Base: `GET /api/resumes/{id}/pdf` (renders from `content` if present, else streams the source).
- Variant: `GET /api/resumes/variants/{id}/pdf`.

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/resumes/3/pdf" -o "$JOBPILOT_WORKSPACE_ROOT/.temp/resume-3.pdf"
```

## Scratch files

Any temporary artifact a skill writes to disk during a campaign - downloaded resume PDFs, generated cover letters, page snapshots, or other scratch output - goes under the project-local `.temp/` directory, never the repo root or the system temp dir. Create it once before writing:

```bash
mkdir -p "$JOBPILOT_WORKSPACE_ROOT/.temp"
```

## 4. Credentials

Resolve the login for a board domain in **one call** - the API applies the precedence (per-board override → `scope === <board-domain>` → `scope === "default"`) server-side, so you never merge endpoints by hand:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/credentials/resolve?domain=<board-domain>"
```

Returns `{ email, password, source }` (`source`: `board` | `domain` | `default`) or `null` (none configured - report to the user, don't guess). The raw rows still live at `GET /api/credentials` (login creds + captcha-service keys) when you need to list or edit them.

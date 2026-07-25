---
name: extract-resume
description: Parse a resume's uploaded PDF into structured JSON (basics, experience, projects, skills, education) and save it to the editor.
argument-hint: "[resume-id] [--force]"
---

# Extract Resume - Source PDF → Structured Data

Read a resume's uploaded source PDF and produce JSON matching the JobPilot resume schema, then save via the API. Inverse of the editor.

## Setup

Follow `../_shared/setup.md`. The profile response provides `user.primaryResumeId`, `primaryResumeSourceAbsolutePath`, and `resumes` (every base with `id`, `label`, `sourceFilename`, `hasData`, `isPrimary`).

## Step 1: Resolve Target

Parse the argument:

- Integer → use that resume id.
- Empty → use `user.primaryResumeId`. If no primary, stop:
  > No primary resume set. Pass an explicit id, or set a primary at <$JOBPILOT_WEB/resumes>.
- `--force` (anywhere) → overwrite existing structured data. Otherwise refuse to overwrite (Step 3).

Let `RESUME_ID` be the resolved id, `FORCE` be `true`/`false`.

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/resumes/$RESUME_ID"
```

If 404, stop and report the id doesn't exist.

## Step 2: Verify Source PDF

`sourceFilename` must be set. If `null`, stop:

> Resume {id} ({label}) has no uploaded source PDF. Upload one at <$JOBPILOT_WEB/resumes/{id}>, then re-run.

Resolve the absolute path:

- Primary resume → prefer `primaryResumeSourceAbsolutePath`.
- Otherwise → `${JOBPILOT_WORKSPACE_ROOT}/apps/api/storage/resumes/{sourceFilename}`.

If `sourceMimeType !== "application/pdf"`, stop and ask the user to re-upload as PDF.

## Step 3: Refuse to Clobber

If `content` is non-null and `FORCE === false`, stop:

> Resume {id} ({label}) already has structured data (version {n}). Edit at <$JOBPILOT_WEB/resumes/{id}>, or re-run with `--force` to overwrite from the PDF.

If `FORCE`, proceed and overwrite.

## Step 4: Read and Parse

`Read` the PDF at the path from Step 2. Produce a single JSON object matching:

```ts
{
  basics: {
    name:     string,           // required
    headline?: string,          // professional title/headline if present
    email?:   string,
    phone?:   string,
    website?: string,
    linkedin?: string,
    github?:  string,
    location?: string,
  },
  summary?: string,             // 1–3 sentences
  experience: Array<{
    company:   string,
    title:     string,
    location?: string,
    start:     string,          // free-form, e.g. "Jul 2022"
    end?:      string,          // omit or "Present" if current
    bullets:   string[],
  }>,
  projects: Array<{
    name:        string,
    url?:        string,
    description?: string,        // one prose line; omit if there's only a tech-stack line
    bullets:     string[],
    keywords:    string[],       // the tech-stack line (e.g. "Next.js, Prisma, Docker")
  }>,
  skills: Array<{
    group: string,              // e.g. "Languages"
    items: string[],
  }>,
  education: Array<{
    school:  string,
    degree:  string,
    start?:  string,
    end?:    string,
    details: string[],
  }>,
}
```

Hard rules:

- **Preserve verbatim** dates, employers, titles, schools, degrees, contact info.
- **Do not invent** roles, bullets, dates, or skills. Missing section → `[]` (or omit optional field).
- Keep the PDF's date display format. Do not normalize to ISO.
- Current role → `end: "Present"` (or omit).
- Skills: keep the PDF's grouping if present; flat list → single group `"Skills"`.
- Strip leading bullet glyphs (•, ▪, –) from bullet text; keep the rest unchanged.
- A project's tech-stack line goes in `keywords` only - never copy it into `description`.
- For long PDFs, use `Read` with `pages` to ingest all pages - don't silently drop later-page entries.

## Step 5: Save

The PUT body must be `{ "content": <resume-object> }` - the API rejects a bare resume payload with 400 "label or content required". Write the file with that wrapper, then send it:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PUT "$JOBPILOT_API/api/resumes/$RESUME_ID" \
  -H "Content-Type: application/json" \
  --data-binary @resume.json
```

Where `resume.json` looks like `{"content": {"basics": {...}, "experience": [...], ...}}`. On 422, read the issue list, fix the field, retry once.

## Step 6: Report

> Extracted resume {id} ({label}) → version {n}.
> Review at <$JOBPILOT_WEB/resumes/{id}>.

Do not echo the parsed fields - the editor and preview show them.

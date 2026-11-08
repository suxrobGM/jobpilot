---
name: extract-resume
description: Parse a resume's uploaded PDF into structured JSON (basics, experience, projects, skills, education) and save it to the editor.
argument-hint: "[resume-id] [--force]"
---

# Extract resume

Read a resume's uploaded PDF, turn it into the JobPilot resume shape, and save it.

## 1. Target

Follow `../_shared/setup.md`. Then:

- `RESUME_ID`: the argument, else `user.primaryResumeId`. Neither: stop with "No primary resume
  set. Pass an id, or set a primary at $JOBPILOT_WEB/resumes."
- `--force` anywhere: overwrite existing content.

`GET /api/resumes/$RESUME_ID`. A `404`: say the id doesn't exist and stop.

- `content` set and no `--force`: stop with "Resume <id> (<label>) already has content. Edit it at
  $JOBPILOT_WEB/resumes/<id>, or run again with `--force` to re-read the PDF."
- No `sourceFilename`: stop with "Resume <id> (<label>) has no uploaded PDF. Upload one at
  $JOBPILOT_WEB/resumes/<id>." Not `application/pdf`: ask the user to upload a PDF.

## 2. Read

```bash
jobpilot-api GET /api/resumes/$RESUME_ID/source --out "$JOBPILOT_TEMP/$RESUME_ID-source.pdf"
```

`Read` the file, every page (use `pages` on long PDFs). Produce:

```ts
{
  basics: { name: string, headline?, email?, phone?, website?, linkedin?, github?, location? },
  summary?: string,
  experience: { company, title, location?, start, end?, bullets: string[] }[],
  projects: { name, url?, description?, bullets: string[], keywords: string[], start?, end? }[],
  skills: { group, items: string[] }[],
  education: { school, degree, start?, end?, details: string[] }[],
  publications: { title, authors?, venue?, year?, url?, doi? }[],
  awards: { title, issuer?, year?, description? }[],
  certifications: { name, issuer?, issued?, expires?, credentialId?, url? }[],
  sections: { title, entries: { heading, subheading?, meta?, bullets: string[] }[] }[],
}
```

- Copy dates, employers, titles, schools, degrees and contact details verbatim. Keep the PDF's date
  format; a current role's `end` is `"Present"`.
- Invent nothing. A missing section is `[]`.
- Project dates only when the PDF shows them: `tailor-resume` uses them to put projects on the
  timeline, so a guessed range becomes a false one.
- A project's tech-stack line goes in `keywords`, never `description`.
- Skills keep the PDF's groups; a flat list is one group, `"Skills"`.
- Strip bullet glyphs from bullet text.
- Never drop a section because it has no field. Grants, talks, patents, teaching, service,
  memberships, volunteering and languages go in `sections` under the PDF's own heading. An academic
  CV is mostly these.
- Publications: one entry per citation, in order. Split `authors`, `title`, `venue` and `year`
  only where the split is unambiguous; otherwise the whole citation goes in `title`. `authors` is
  verbatim, "et al." included; `year` is free text ("2024", "In press").

## 3. Save

The body must wrap the resume: `{"content": {...}}`. Write it to `$JOBPILOT_TEMP/resume.json`:

```bash
jobpilot-api PUT /api/resumes/$RESUME_ID --data @"$JOBPILOT_TEMP/resume.json"
```

On `422`, read the issues, fix them, and retry once.

## 4. Review

Only on a first extraction (`content` was null): run the `review-resume` skill for `RESUME_ID`. It
proposes a stronger version. Skip it with `--force`: the user re-read the PDF to get back what it
says.

## 5. Report

> Extracted resume <id> (<label>). Review it at $JOBPILOT_WEB/resumes/<id>.

Don't echo the parsed fields.

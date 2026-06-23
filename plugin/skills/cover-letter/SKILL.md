---
name: cover-letter
description: Write a tailored one-page cover letter from a job description and the user's resume, humanized for natural tone.
argument-hint: "<job_description>"
---

# Cover Letter Generator

Write a tailored, one-page cover letter connecting the candidate's resume to a specific role.

## Setup

Follow `../shared/setup.md` to load profile and resume. Then `Read` the resume file at `primaryResumeSourceAbsolutePath` for full context (identity, education, experience, skills, projects, research, awards).

## Step 1: Analyze the JD

From the argument, identify: company + what they do, role title and level, key responsibilities, required/preferred qualifications, tech stack and domain, culture cues.

## Step 2: Select Relevant Experience

From the resume, pick the most relevant: 2–3 work experiences, 2–3 projects, research (if AI/ML/CV), education (if relevant to level).

## Step 3: Write

**Header** (values from `profile.*`):

```
[Full Name]
[City, State] | [Phone] | [Email]
[LinkedIn] | [GitHub] | [Website]
```

**Opening (2–3 sentences):** state the role, lead with strongest specific qualifier, show you understand what the team needs. **No** "I'm excited to apply" / "I'm writing to express my interest".

**Body 1 — relevant experience (3–5 sentences):** connect your closest work to their needs, include specific metrics and outcomes, name projects and results (not just technologies).

**Body 2 — technical depth (3–5 sentences):** deeper alignment with their stack/domain, reference specific projects or research. For AI/ML roles: reference publications.

**Body 3 — why this company (2–3 sentences):** what specifically draws you here (genuine, not generic), how your background uniquely fits, what you'd bring beyond the requirements.

**Closing (2–3 sentences):** interest in discussing further, portfolio/GitHub link if relevant, brief thanks.

**Sign-off:**

```
Best regards,
[Full Name]
```

## Step 4: Apply Humanizer

Invoke the `humanizer` skill on the full text. The final output must read as written by a real person.

## Step 5: Save to History

Persist the final letter so it's reviewable in the web app. Best-effort — if the call fails, continue:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/cover-letters" -H 'content-type: application/json' \
  -d "$(jq -n --arg c "<final letter text>" --arg u "<job url>" --arg t "<role title>" --arg co "<company>" --arg s "<source>" \
        '{content:$c, jobUrl:($u|select(.!="")), jobTitle:($t|select(.!="")), company:($co|select(.!="")), source:$s}')"
```

`jobUrl`/`jobTitle`/`company` come from the JD argument (`$DIGEST` fields when present). `source` is the invoking context — `apply`, `auto-apply`, or `manual` (default `manual` when the caller didn't specify).

## Rules

1. **One page.** 350–450 words for the body.
2. **No fluff** — drop "passionate", "dedicated", "committed", "excited", "thrilled", "leverage", "utilize", "innovative", "cutting-edge", "eager", "dynamic".
3. **No generic openings.**
4. **Be specific.** Real project names, metrics, technologies from the resume.
5. **Tailor aggressively.** Every sentence should connect to something in the JD.
6. **Show, don't tell.** No "I'm a strong communicator" — demonstrate it through the writing.
7. **Match tone.** Startup → conversational; enterprise/gov → formal.
8. **No fabrication.** Only reference projects/skills from the resume.
9. **First person** as the candidate.
10. **AI/ML/research roles:** lead with publications and academic background.
11. **Senior/lead roles:** lead with years, team collaboration, architectural decisions.
12. **Startup roles:** lead with breadth of shipped products and autonomy.

## Output

Plain text with header and sign-off, ready to paste or convert to PDF.

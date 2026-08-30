---
name: cover-letter
description: Write a tailored, concise cover letter (150-250 words) from a job description and the user's resume, humanized for natural tone.
argument-hint: "<job_description>"
---

# Cover Letter Generator

Write a short, tailored cover letter connecting the candidate's resume to a specific role.

## Setup

Follow `../_shared/setup.md` to load profile and resume. That structured resume is what you write from - experience, projects, skills, education, publications, awards, certifications and any custom sections are all in it. Don't also `Read` the source PDF: it's the same content again at several times the size, and inside an apply flow that cost is paid per job.

## Step 1: Analyze the JD

From the argument, identify: company + what they do, role title and level, key responsibilities, required/preferred qualifications, tech stack and domain, culture cues.

## Step 2: Read Your Last 5 Letters

Do not skip. Letters that are individually fine and collectively identical are what reads as AI - not word choice.

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/cover-letters?page=1&pageSize=5" | jq -r '.items[].id'
```

The list is metadata only, so `GET /api/cover-letters/<id>` each for the body. No history (first letter, or the call fails) → Step 3.

Take three things from each and drop the rest: which experience it **led** with, its metric phrasings, and its closing sentence. Those are what rules 14-16 compare against; keeping five whole letters in context buys nothing beyond them.

## Step 3: Select Relevant Experience

From the resume, pick the most relevant: 2–3 work experiences, 2–3 projects, research (if AI/ML/CV), education (if relevant to level).

**Apply rules 14-16 here**, against Step 2's letters. Rotating the lead is a selection decision - make it before drafting, not by patching a draft that already opened with the usual paragraph.

## Step 4: Write

**Header** - values strictly from `user.*`, never from the resume file (resumes carry stale addresses). Omit any line whose fields are empty:

```
[Full Name]
[City, State] | [Phone] | [Email]
[LinkedIn] | [GitHub] | [Website]
```

**Body - 150–250 words, 3–4 paragraphs of uneven length.**

Pick ONE lead angle - the strongest for this JD, not a stack of all three:

- a result that matches their core need (senior/lead roles: scope, architecture, team output)
- direct experience with their exact stack, domain, or product (AI/ML/research roles: publications)
- a genuine, specific reason for this company - only if you actually have one

Then write:

- **Lead (1–3 sentences):** the role + your angle. **No** "I'm excited to apply" / "I'm writing to express my interest".
- **Proof (1–2 short paragraphs):** 1–2 proof points from the resume - a named project or outcome with one concrete detail each. Pick the points that fit *this* JD, not your two best overall. Let each stand on its own; don't explain why it's relevant - if you picked right, it's obvious.
- **Close (1–2 sentences):** you'd like to talk, thanks. No recap of fit.

If the draft came out as opening → experience → tech depth → why-company → closing, that's the template every AI letter follows - merge or cut a section and vary where the company mention lands.

**Sign-off:**

```
Best regards,
[Full Name]
```

## Step 5: Apply Humanizer

Invoke the `humanizer` skill on the full text in **embedded mode** - final rewrite only, no draft or audit bullets.

Then re-check against Step 2's letters: no shared sentence, different lead, different closing. The humanizer sees one document at a time, so this check is yours.

## Step 6: Save to History

Persist the final letter so it's reviewable in the web app. Best-effort - if the call fails, continue:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/cover-letters" -H 'content-type: application/json' \
  -d "$(jq -n --arg c "<final letter text>" --arg u "<job url>" --arg t "<role title>" --arg co "<company>" --arg s "<source>" \
        '{content:$c, jobUrl:($u|select(.!="")), jobTitle:($t|select(.!="")), company:($co|select(.!="")), source:$s}')"
```

`jobUrl`/`jobTitle`/`company` come from the JD argument (`$DIGEST` fields when present). `source` is the invoking context - `apply`, `auto-apply`, or `manual` (default `manual` when the caller didn't specify).

## Rules

1. **150–250 words for the body.** Short reads as confident.
2. **No fluff** - drop "passionate", "dedicated", "committed", "excited", "thrilled", "leverage", "utilize", "innovative", "cutting-edge", "eager", "dynamic".
3. **No generic openings.**
4. **Be specific.** Real project names, metrics, technologies from the resume.
5. **Tailor by selection, not narration.** Prove fit by choosing the right material. Quote back at most ONE short JD phrase in the whole letter. Never end a paragraph by mapping yourself onto the JD - no "which is exactly what your team needs", "the same kind of X that Y requires", "which is basically the job description".
6. **End paragraphs on the fact** - what you did or why you're interested - not a tie-back or a flourish.
7. **One dash clause max** per letter (em dash or " - "); restructure the rest into commas or separate sentences.
8. **One contrast max** per letter - "X rather than Y" / "not X, but Y" is a crutch; usually delete the negative half.
9. **No rule-of-three.** Don't default to three-item lists; name one thing, or two, or four.
10. **Show, don't tell.** No "I'm a strong communicator" - demonstrate it through the writing.
11. **Match tone.** Startup → conversational; enterprise/gov → formal.
12. **No fabrication.** Only reference projects/skills from the resume.
13. **First person** as the candidate.

### Anti-repetition (against Step 2's letters)

14. **Rotate the lead.** Don't open with the experience either of the last two letters opened with, unless the JD makes it the only honest choice (a healthcare role genuinely wants the healthcare project). A recruiter comparing two of your letters is comparing openings.
15. **No sentence reused verbatim**, metric phrasings included. A reused number is fine; a reused *sentence about* it is the tell. Rephrase the result or lead with a different one.
16. **Vary the closing and the shape.** No repeated closing, and never "how this maps to/onto <Company>". Move the company mention too - same skeleton with different nouns is still a template.

## Output

Plain text with header and sign-off, ready to paste or convert to PDF.

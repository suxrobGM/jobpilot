---
name: tailor-resume
description: Choose the best existing resume base/variant for a job, or create a new tailored variant when nothing fits.
argument-hint: "<digest-json | job-url | pasted-jd-text> [--base <resumeId>]"
---

# Tailor Resume - Reuse or Create

Choose or produce a resume for a specific job. You decide reuse vs create; the user does not pre-select.

## Setup

Follow `../_shared/setup.md`. The profile response includes `resumes` (every base with `label`, `hasData`, `variantCount`, `isPrimary`).

## Step 1: Build the JD object

Detect the argument shape:

- Starts with `{` → parse as digest JSON. **No navigation, no snapshot.**
- Starts with `http` → `browser_navigate`, then `browser_snapshot` the posting body (per `../_shared/browser-tips.md`) and build the digest (`../_shared/digest-schema.md`) from it.
- Otherwise → pasted JD text; parse the same fields manually.

From the digest (`title`, `requirements[]`, `responsibilities[]`, `techStack[]`, `yearsExperience`, `descriptionExcerpt`), assemble:

- `title`, `domain` (fintech/healthtech/devtools/…), `standouts` (clearance, on-call, on-site, …).
- `roleFamily` ∈ `frontend | backend | fullstack | mobile | data | ml | devops | qa | other` - match `title` + `descriptionExcerpt` against: frontend (`frontend`, `ui`, `react`, `vue`, `angular`), backend (`backend`, `api`, `services`), fullstack (`full-stack`), mobile (`ios`, `android`, `react native`, `flutter`), data (`data engineer/scientist`, `analytics`, `etl`), ml (`ml`, `ai engineer`, `mlops`), devops (`devops`, `sre`, `platform`, `infrastructure`), qa (`qa`, `sdet`, `test engineer`).
- `seniority` ∈ `junior | mid | senior | staff | lead` - from title (`junior`/`entry` → junior; `senior`/`sr.` → senior; `staff` → staff; `lead`/`principal` → lead; else mid). Cross-check `yearsExperience`: 0-2 junior, 3-5 mid, 6-9 senior, 10+ staff/lead.
- `keywords` - top 10 required-tech terms from `techStack` ∪ extracted from `requirements`. Lowercase, deduped, must-have ranked above nice-to-have.
- `responsibilityTerms` - top 5 verbs/nouns from `responsibilities` (`design`, `mentor`, `migrate`, `on-call`, …).

## Step 2: Pick the Base

**Campaign choice wins.** If `--base <resumeId>` was passed (the campaign's selected resume) and
that resume has `hasData` or a `sourceFilename`, use it as `BASE_ID` (skip scoring). Else **primary
wins**: if `primaryResumeId` is set and that resume has `hasData` or a `sourceFilename`,
use it as `BASE_ID` (skip scoring; Step 3 extracts content if missing). Otherwise score each
`resumes` entry (max 10):

| Signal              | Points | Rule                                                                                |
| ------------------- | ------ | ----------------------------------------------------------------------------------- |
| Exact role-family   | +4     | `label` maps to `JD.roleFamily`.                                                    |
| Adjacent family     | +2     | frontend↔fullstack, backend↔fullstack, ml↔data, devops↔backend. Not both.           |
| `hasData: true`     | +1     | Enables content scoring; cheaper to tailor.                                         |
| `isPrimary: true`   | +1     |                                                                                     |
| JD keyword coverage | +0..+3 | If `hasData`, fetch base; `round(3 × matched/10)` over skills + projects + summary. |
| Recency             | +1     | `updatedAt` within 90 days.                                                         |

Highest wins. Tie-break: primary → most recent → lowest id. If no candidate has `hasData` AND no `sourceFilename`, stop:

> No usable base resume. Upload a PDF at <$JOBPILOT_WEB/resumes>, or fill a resume's editor manually, then re-run.

Let `BASE_ID` be the chosen id.

## Step 3: Extract Structure if Missing

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/resumes/$BASE_ID"
```

If `content` is `null`, delegate to extract-resume so the logic stays in one place:

> Run the `extract-resume` skill for `$BASE_ID` and wait for it to finish.

Refetch the base row afterward - Step 5 needs the saved `content`. If extract-resume stops because there's no `sourceFilename`, surface the same message and stop.

Skip this step when `hasData: true`.

## Step 4: Decide Reuse vs Create

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/resumes/$BASE_ID/variants"
```

For each variant, fetch `GET /api/resumes/variants/<id>` and compute `reuseScore` (0-100). Variants failing the role-family gate (different family AND not adjacent) score 0.

| Component            | Max | Calculation                                                                                          |
| -------------------- | --- | ---------------------------------------------------------------------------------------------------- |
| Keyword coverage     | 40  | `40 × matched/10` of `JD.keywords` across skills + project keywords + summary + bullets.             |
| Title similarity     | 15  | `15 ×` Jaccard token overlap of `JD.title` vs `variant.label`, stripping `engineer/senior/the/at/-`. |
| Responsibility cover | 15  | `15 × matched/5` of `JD.responsibilityTerms` in summary + bullets.                                   |
| Seniority alignment  | 15  | Exact 15; one step off (mid↔senior, senior↔staff) 8; further 0.                                      |
| Domain match         | 5   | `JD.domain` appears in summary or any bullet.                                                        |
| Recency              | 10  | ≤30d 10; ≤90d 7; ≤180d 4; else 0.                                                                    |

Pick the highest scorer:

- **≥75** → reuse.
- **60-74** → reuse, echo a one-line caveat naming the weakest component.
- **<60** or no variant passes the gate → Step 5.

On reuse:

> Reusing variant {id}: {label} (score {n}/100).
> $JOBPILOT_API/api/resumes/variants/{id}/pdf

Stop.

## Step 5: Create a New Variant

The server does all structural rewriting (skill ordering, bullet ranking) deterministically. You write only:

- **`summary`** - ≤3 sentences targeting this role, written the way the candidate would write it. Plain, specific; mirror 2-3 JD keywords naturally where the resume genuinely supports them. No clichés, no "passionate"/"results-driven" filler, no three-item trait lists, no "X rather than Y" framing. **No fabrication** of experience, scope, or numbers.
- **`emphasizedTech`** - 4-8 lowercase tech terms from `JD.keywords` to surface first in skill groups.
- **`jobKeywords`** - optional, ~10 terms; defaults to `emphasizedTech`. Ranks experience/project bullets.
- **`label`** - `"{Company} - {Title}"` (short).
- **`jobUrl`** - when the argument was a URL or digest carried one.
- **`applicationId`** - when the JD URL matches an existing Application (`GET /api/applied/check?url=…` → `.match.application.id`).
- **`diffNotes`** - 1-3 sentences on what was emphasized and why.

### Optional - reword recent bullets

You may rephrase bullets on the **top 1-2 roles** to match the JD's wording. Omit when reordering alone suffices (the safe default).

- **`bulletRewrites`** - `[{ entryIndex, bullets: [{ original, tailored }] }]`. Copy `original` verbatim from `experience[entryIndex].bullets`; rephrase `tailored` to lead with the JD-relevant outcome. Add **no** number, date, employer, tech, or scope not already in that bullet - it must hold up in an interview.
- **`rewordTopN`** - optional, default `2`; allowed `entryIndex` is `0..rewordTopN-1`.

Server-enforced: **422** on a new number, an unknown `original`, or out-of-window `entryIndex`; non-blocking **`flags`** for tech terms absent from the resume. On 422, read `details`, fix the text, resend - never drop the guardrail.

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/resumes/$BASE_ID/tailor" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg summary "<2-3 sentence tailored summary>" \
                --arg label "<Company> - <Title>" \
                --arg jobUrl "<job-url-or-empty>" \
                --argjson tech '["typescript","react","next.js","aws"]' \
                --argjson rewrites '[{"entryIndex":0,"bullets":[{"original":"<verbatim base bullet>","tailored":"<rephrased to JD, no new facts>"}]}]' \
    '{label:$label, jobUrl:($jobUrl|select(length>0)), emphasizedTech:$tech, jobKeywords:$tech, summary:$summary, bulletRewrites:$rewrites, diffNotes:"Surfaced React/Next.js ahead of other tech; reworded 1 recent bullet to the JD."}')"
```

Response `{ id, pdfUrl, rewordedBullets, flags }`. Echo:

> Created variant {id} from base {baseId} ({rewordedBullets} reworded).
> $JOBPILOT_API{pdfUrl}

If `flags` is non-empty, append: `⚠ verify - not elsewhere in your resume: {flags}`.

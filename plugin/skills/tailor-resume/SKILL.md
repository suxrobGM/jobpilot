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

From the digest (`title`, `requirements[]`, `responsibilities[]`, `skills[]`, `yearsExperience`, `descriptionExcerpt`), assemble:

- `title`, `domain` (fintech/healthtech/devtools/…), `standouts` (clearance, on-call, on-site, …).
- `roleFamily` ∈ `frontend | backend | fullstack | mobile | data | ml | devops | qa | other` - match `title` + `descriptionExcerpt` against: frontend (`frontend`, `ui`, `react`, `vue`, `angular`), backend (`backend`, `api`, `services`), fullstack (`full-stack`), mobile (`ios`, `android`, `react native`, `flutter`), data (`data engineer/scientist`, `analytics`, `etl`), ml (`ml`, `ai engineer`, `mlops`), devops (`devops`, `sre`, `platform`, `infrastructure`), qa (`qa`, `sdet`, `test engineer`).
- `seniority` ∈ `junior | mid | senior | staff | lead` - from title (`junior`/`entry` → junior; `senior`/`sr.` → senior; `staff` → staff; `lead`/`principal` → lead; else mid). Cross-check `yearsExperience`: 0-2 junior, 3-5 mid, 6-9 senior, 10+ staff/lead.
- `keywords` - top 10 required skill terms from `skills` ∪ extracted from `requirements`. Lowercase, deduped, must-have ranked above nice-to-have.
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

**Check `profileMismatches` on the base response.** Non-empty means the recruiter reads one address and the form submits another. Echo once, don't block the apply:

> ⚠ resume disagrees with your profile: {field} says "{resume}", profile says "{profile}". Fix at $JOBPILOT_WEB/resumes/{baseId}

## Step 4: Decide Reuse vs Create

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/resumes/$BASE_ID/variants"
```

**Shortlist first.** Rank the list response by title similarity and fetch `GET /api/resumes/variants/<id>` for the **top 5** only - a base with 60 variants would otherwise cost 60 fetches per job.

Compute `reuseScore` (0-100) for the shortlist. Variants failing the role-family gate (different family AND not adjacent) score 0. Skip `Suggested rewrite` variants - they are not tailored for any job.

| Component            | Max | Calculation                                                                                          |
| -------------------- | --- | ---------------------------------------------------------------------------------------------------- |
| Keyword coverage     | 40  | `40 × matched/10` of `JD.keywords` across skills + project keywords + summary + bullets.             |
| Title similarity     | 20  | `20 ×` Jaccard token overlap of `JD.title` vs `variant.label`, stripping `engineer/senior/the/at/-`. |
| Responsibility cover | 15  | `15 × matched/5` of `JD.responsibilityTerms` in summary + bullets.                                   |
| Seniority alignment  | 15  | Exact 15; one step off (mid↔senior, senior↔staff) 8; further 0.                                      |
| Domain match         | 5   | `JD.domain` appears in summary or any bullet.                                                        |
| Recency              | 5   | ≤180d 5; else 0.                                                                                     |

Pick the highest scorer:

- **≥60** → reuse.
- **45-59** → reuse, echo a one-line caveat naming the weakest component.
- **<45** or no variant passes the gate → Step 5.

**Hard cap.** At **≥15** variants on a base, reuse the best scorer passing the role-family gate whatever it scored, and say so:

> Reusing variant {id} (score {n}/100) - {baseId} is at {count} variants. Prune at $JOBPILOT_WEB/resumes/{baseId} to allow new ones.

Reuse is the default; creating is the exception. A variant is a near-duplicate of its base with reordered bullets, so a fresh one gains little at unbounded cost. Recency contributes almost nothing on purpose - decaying a good variant's score is what turns every application into a new row.

On reuse:

> Reusing variant {id}: {label} (score {n}/100).
> $JOBPILOT_API/api/resumes/variants/{id}/pdf
> `RESUME_USED base={baseId} variant={id}`

Stop.

## Step 5: Create a New Variant

The server does all structural rewriting (skill ordering, bullet ranking) deterministically. You write only:

- **`summary`** - ≤3 sentences targeting this role, written the way the candidate would write it. Plain, specific; mirror 2-3 JD keywords naturally where the resume genuinely supports them. No clichés, no "passionate"/"results-driven" filler, no three-item trait lists, no "X rather than Y" framing. **No fabrication** of experience, scope, or numbers.
- **`emphasizedTech`** - 4-8 lowercase tech terms from `JD.keywords` to surface first in skill groups.
- **`jobKeywords`** - optional, ~10 terms; defaults to `emphasizedTech`. Ranks experience/project bullets.
- **`headline`** - optional, retargets `basics.headline`.
- **`label`** - `"{Company} - {Title}"` (short).
- **`jobUrl`** - when the argument was a URL or the digest carried one. Always send it: it's how the server ties the variant to its Application once the apply reports a result.
- **`diffNotes`** - 1-3 sentences on what was emphasized and why.

### Optional - reword bullets

Any role is rewordable. Omit when reordering alone suffices; reach down the timeline only when the recent roles don't carry the JD's story.

- **`bulletRewrites`** - `[{ entryIndex, bullets: [{ original, tailored }] }]`. Copy `original` verbatim from `experience[entryIndex].bullets`; rephrase `tailored` to lead with the JD-relevant outcome. Add **no** number, date, employer, tech, or scope not already in that bullet - it must hold up in an interview.

### Optional - restructure

Use `structure` when reordering and rewording can't fix the gap: the base's role family doesn't match the JD, or no variant scored above 40 in Step 4. A close-fitting base gains nothing and every move is one more thing to defend in an interview.

- **`entryOrder`** - permutation of the surviving indices.
- **`dropEntries`** - at most half, never all.
- **`mergeEntries`** - `[{ into, from[], company?, title? }]`. Concatenates bullets. Use on short or overlapping roles - overlapping dates read as an error. `company` must be a merged employer or an umbrella name (`Independent / Contract`, `Freelance`, `Self-employed`, `Independent Software Development`).
- **`promoteProjects`** - `{ projects[], company?, title? }`. Lifts projects onto the timeline, turning a gap between jobs into visible work. Umbrella `company` only.
- **`projectOrder`** - listed projects move to the front, rest keep their order.

**Indices refer to the base resume**, never an intermediate state. Server order: merge, drop, promote, reorder. `bulletRewrites` indices refer to the **result**, since rewrites are validated after the restructure.

### What the server refuses (422)

Tailoring changes presentation, not facts:

- A number in `tailored` that isn't in its `original`.
- An `original` that isn't a bullet of that entry, or an `entryIndex` that doesn't exist.
- A merged date range - **there is no field for one.** The server derives start/end from the merged roles, so a range collapses but never widens.
- An employer that is neither a merged company nor an umbrella name.
- Promoting a project with no `start`. Add dates to the base first (`PUT /api/resumes/{id}`).
- Dropping every entry, or more than half.

On 422, read `details`, fix, resend - never drop the guardrail. Non-blocking **`flags`** name tech absent from the resume and a `title` sharing no word with the original (`retitled: "X" -> "Y"`). Echo them - they're what you'll be asked about in an interview.

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

With a restructure, add `headline` and `structure`:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/resumes/$BASE_ID/tailor" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg label "<Company> - <Title>" \
                --arg summary "<retargeted summary>" \
                --arg headline "<retargeted headline>" \
                --argjson tech '["pytorch","computer vision","python"]' \
                --argjson structure '{"mergeEntries":[{"into":2,"from":[3],"company":"Independent / Contract"}],"promoteProjects":{"projects":[4]},"entryOrder":[0,1,2]}' \
    '{label:$label, summary:$summary, headline:$headline,
      emphasizedTech:$tech, jobKeywords:$tech, structure:$structure,
      diffNotes:"Merged two overlapping 2020-21 roles; promoted the CV research project; led with ML."}')"
```

Response `{ id, pdfUrl, rewordedBullets, flags }`. Echo:

> Created variant {id} from base {baseId} ({rewordedBullets} reworded).
> $JOBPILOT_API{pdfUrl}
> `RESUME_USED base={baseId} variant={id}`

If `flags` is non-empty, append: `⚠ verify - not elsewhere in your resume: {flags}`.

The variant's `rewrites` audit records every structural change, so `GET /api/resumes/variants/{id}` shows exactly what moved.

## Return to the caller

Every path - reuse and create alike - ends with the `RESUME_USED base={baseId} variant={id}` line
above. Apply flows read it to report what was submitted on the job result, and an application whose
result carries no resume shows nothing under Documents. Omit `variant=` only when no variant is
involved at all and the base PDF itself goes to the form.

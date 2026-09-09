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

A variant is the base resume with the JD-relevant parts moved to the front. It is not a new resume. The reader should not be able to tell it was tailored, only that it fits. The server reorders skills and ranks bullets from your hints, so most of the work is choosing terms, not writing prose.

Send only what changes something:

- **`label`** - `"{Company} - {Title}"`.
- **`jobUrl`** - whenever the argument was a URL or the digest carried one. It is how the server ties the variant to its application.
- **`emphasizedTech`** - 4-8 lowercase terms from `JD.keywords`. They move to the front of their skill groups.
- **`jobKeywords`** - optional, about 10 terms. They rank bullets inside each entry. Defaults to `emphasizedTech`.
- **`diffNotes`** - one or two sentences on what was emphasized and why.

### Summary

Leave `summary` out when the base already fits. It usually does.

When one sentence of the base speaks to the wrong audience, swap that sentence and keep the rest word for word. The new sentence states one fact from the resume that this JD cares about, in the candidate's voice. Keep the base's proof: its publications, its years, its domains, its numbers. Never restate the JD, and never open with a title followed by a list of tools.

### Headline

Optional. A job title, nothing more. Retarget it only when the base headline names a different discipline than the JD.

### Bullet rewrites

Reordering is the default and usually suffices. Reword a bullet only when its JD-relevant fact sits mid-sentence, and reword at most two or three across the whole resume.

`bulletRewrites` is `[{ entryIndex, bullets: [{ original, tailored }] }]`. Copy `original` verbatim from `experience[entryIndex].bullets`. `tailored` is the same sentence with the relevant fact first. Every noun, number, and tech name stays. Nothing is added: no audience, no consequence, no clause on why the work mattered. A concrete noun never becomes a vaguer one; "clinical notes" turning into "unstructured records" is a loss, not tailoring.

### Restructure

Use `structure` only when reordering and rewording cannot close the gap: the base's role family differs from the JD, or no variant scored above 40 in Step 4. Every move is one more thing to defend in an interview.

- **`entryOrder`** - permutation of the surviving indices.
- **`dropEntries`** - at most half, never all.
- **`mergeEntries`** - `[{ into, from[], company?, title? }]`. Use on short or overlapping roles. `company` is one of the merged employers or an umbrella name (`Independent / Contract`, `Freelance`, `Self-employed`, `Independent Software Development`). There is no date field: the server derives the range from the merged roles.
- **`promoteProjects`** - `{ projects[], company?, title? }`. Lifts projects onto the timeline. Each project needs a `start` on the base first (`PUT /api/resumes/{id}`). Umbrella `company` only.
- **`projectOrder`** - listed projects move to the front, the rest keep their order.

Indices refer to the base resume, never an intermediate state. The server applies merge, drop, promote, reorder in that order. `bulletRewrites` indices refer to the result.

### When the server says no

The server checks that every field you wrote states only what the resume states, keeps the facts it started with, and reads like the candidate rather than a job ad. A failure is a 422 whose `details` name the field and the reason. Apart from `structure`, which is checked first on its own, `details` lists every problem in one response, so fix them together. Read it, then send less: drop the summary or the rewrite instead of rephrasing it a third time. Never work around a rejection.

The response also carries non-blocking `flags`, currently only a retitle that shares no word with the original. Echo them; they are what the candidate will be asked about.

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/resumes/$BASE_ID/tailor" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg label "<Company> - <Title>" \
                --arg jobUrl "<job-url-or-empty>" \
                --argjson tech '["typescript","react","next.js","aws"]' \
    '{label:$label, jobUrl:($jobUrl|select(length>0)), emphasizedTech:$tech, jobKeywords:$tech, diffNotes:"Surfaced React/Next.js ahead of other tech."}')"
```

With a swapped summary sentence and one reword:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/resumes/$BASE_ID/tailor" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg label "<Company> - <Title>" \
                --arg jobUrl "<job-url-or-empty>" \
                --arg summary "<base summary with one sentence swapped>" \
                --argjson tech '["typescript","react","next.js","aws"]' \
                --argjson rewrites '[{"entryIndex":0,"bullets":[{"original":"<verbatim base bullet>","tailored":"<same facts, relevant one first>"}]}]' \
    '{label:$label, jobUrl:($jobUrl|select(length>0)), emphasizedTech:$tech, jobKeywords:$tech, summary:$summary, bulletRewrites:$rewrites, diffNotes:"Swapped the summary's last sentence for the HIPAA work; led the EmTech entry with the NLP bullet."}')"
```

With a restructure:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/resumes/$BASE_ID/tailor" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg label "<Company> - <Title>" \
                --arg headline "<job title>" \
                --argjson tech '["pytorch","computer vision","python"]' \
                --argjson structure '{"mergeEntries":[{"into":2,"from":[3],"company":"Independent / Contract"}],"promoteProjects":{"projects":[4]},"entryOrder":[0,1,2]}' \
    '{label:$label, headline:$headline, emphasizedTech:$tech, jobKeywords:$tech, structure:$structure,
      diffNotes:"Merged two overlapping 2020-21 roles; promoted the CV research project; led with ML."}')"
```

Response `{ id, pdfUrl, rewordedBullets, flags }`. Echo:

> Created variant {id} from base {baseId} ({rewordedBullets} reworded).
> $JOBPILOT_API{pdfUrl}
> `RESUME_USED base={baseId} variant={id}`

If `flags` is non-empty, append: `⚠ verify - {flags}`.

`GET /api/resumes/variants/{id}` returns the `rewrites` audit, which records every reword and structural move.

## Return to the caller

Every path - reuse and create alike - ends with the `RESUME_USED base={baseId} variant={id}` line
above. Apply flows read it to report what was submitted on the job result, and an application whose
result carries no resume shows nothing under Documents. Omit `variant=` only when no variant is
involved at all and the base PDF itself goes to the form.

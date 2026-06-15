# Form Filling

Job applications often span multiple pages. For each page:

## Identify and Fill

1. **Enumerate fields** — take a `browser_snapshot` narrowed to the form container. Each input / textarea / select / checkbox / radio carries a `label` and a stable `ref` usable by `browser_click` / `browser_type` / `browser_select_option`.
2. **Map fields** to profile/resume data using the label, placeholder, and name.
3. **Fill** addressing each by `ref`:
   - Text inputs → `browser_type` (or `browser_fill_form` for batch)
   - Selects → `browser_select_option`
   - Checkboxes / radios → `browser_click`
   - File uploads (resume) → fetch the tailored variant from the caller's prior step into the scratch dir (see `./setup.md` "Scratch files"): `mkdir -p "$JOBPILOT_WORKSPACE_ROOT/.temp" && curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/resumes/variants/<id>/pdf" -o "$JOBPILOT_WORKSPACE_ROOT/.temp/resume.pdf"`, then `browser_file_upload` that path.
   - Date fields → use the appropriate date format
4. **Custom widgets** (date pickers, autocomplete combos, rich-text editors) the form snapshot couldn't enumerate cleanly: narrow the `browser_snapshot` to just that widget's container to obtain a ref.

## Special Fields

All paths refer to `GET /api/profile` (already loaded by setup.md).

- **Name** → `profile.{firstName, lastName}`.
- **Email** → `profile.email`. **Always use this profile email — never your own account/assistant email, the credential login email, or any address seen elsewhere in the conversation.** When in doubt, re-read `profile.email` and use it verbatim.
- **Address** → `profile.{street,aptUnit,city,state,zipCode,country}`
- **Phone** → `profile.phone`
- **LinkedIn / GitHub / Website** → `profile.{linkedin,github,website}`
- **Salary expectations** → ask the user the first time it's needed and remember the answer for the rest of the campaign. For radios/dropdowns, pick the closest match.
- **Start date** → "Immediately" or "2 weeks notice" unless `autoApply.defaultStartDate` overrides.
- **Cover letter** (a textarea or a file-upload field labelled "cover letter") → generate via the `cover-letter` skill (already humanized; it also saves the letter to history — pass `source` = the invoking skill, `apply` or `auto-apply`). Then:
  - Text area → paste the text directly.
  - File upload → render the text to PDF and upload it: `curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/cover-letters/pdf" -H 'content-type: application/json' -d "$(jq -n --arg t "<letter text>" '{text:$t}')" -o "$JOBPILOT_WORKSPACE_ROOT/.temp/cover-letter.pdf"`, then `browser_file_upload` that path (overwritten each time).
- **"How did you hear about us?"** → "Job board" or "Company website".
- **Years of experience** → calculate from earliest work experience date.
- **Custom questions** → best judgment from the resume. Genuinely uncertain → ask (loop skills: make a reasonable attempt and log in notes).
- **Relocation** → `profile.willingToRelocate`. For preferred/target locations, use `profile.preferredLocations`. Empty `[]` or contains `"Anywhere"` → user is open, answer accordingly without asking.
- **Work auth / visa** → `profile.{usAuthorized, requiresSponsorship, visaStatus, optExtension}`. Map to form questions; for dropdowns, pick the closest option.
- **EEO / Diversity** → `profile.{eeoGender, eeoRace, eeoEthnicity, eeoHispanicOrLatino, eeoVeteranStatus, eeoDisabilityStatus}`. Null → "Prefer not to disclose".
- **References** → `profile.references[]`, each `{name, relationship, company, email, phone}`. Fill reference rows in order. If the form requires references and the array is empty, fill what you can and note the gap — never invent one.

## Multi-Page Navigation

1. After filling each page, find "Next" / "Continue" / "Save & Continue" and click.
2. Repeat the fill process on each new page.
3. **Re-snapshot the form** on each page to verify values landed before clicking Next.

# Form Filling

Job applications often span multiple pages/steps. For each page:

## Identify and Fill Fields

1. **Take a snapshot** of the current form state.
2. **Identify all form fields** -- text inputs, textareas, selects, checkboxes, radio buttons, file uploads.
3. **Map each field** to the candidate's profile and resume data using field labels, placeholders, and names.
4. **Fill fields** using Playwright MCP tools:
   - Text inputs -> `browser_fill_form` or `browser_click` + `browser_type`
   - Dropdowns/selects -> `browser_select_option`
   - Checkboxes/radio buttons -> `browser_click`
   - File uploads (resume) -> `browser_file_upload` with the resume path from `profile.json > personal.resumePath`
   - Date fields -> use the appropriate date format for the field

## Special Fields

- **Address fields** -> use `profile.json > address.*`
- **Phone number** -> use `profile.json > personal.phone`
- **LinkedIn/GitHub/Website** -> use `profile.json > personal.linkedin`, `personal.github`, `personal.website`
- **Salary expectations** -> Ask the user before filling (in autopilot mode: ask once on first encounter, remember for the rest of the run).
- **Start date** -> "Immediately" or "2 weeks notice" unless configured otherwise in `autopilot.defaultStartDate`.
- **Cover letter** -> Generate a tailored cover letter using `/jobpilot:cover-letter` with the job description. The cover-letter skill already runs through the humanizer. Then determine the field type:
  - **Text area** -> paste the cover letter text directly into the field.
  - **File upload only** -> save the generated cover letter to `${CLAUDE_PLUGIN_ROOT}/cover-letter.txt` using the `Write` tool, then use `browser_file_upload` to upload that file. Reuse the same file path for each application (it gets overwritten each time).
- **"How did you hear about us?"** -> "Job board" or "Company website" as appropriate.
- **Years of experience** -> Calculate from the earliest work experience date in the resume.
- **Custom questions** -> Use best judgment from the candidate's resume. If genuinely uncertain, ask the user (in autopilot mode: make a reasonable attempt and log it in notes).
- **Work authorization / visa sponsorship** -> Use `profile.json > workAuthorization`. Answer "Are you authorized to work in the US?" with `usAuthorized`, "Will you require sponsorship?" with `requiresSponsorship`, visa status with `visaStatus`, and OPT details with `optExtension`. If the field is a dropdown, select the closest matching option.
- **EEO/Diversity questions** -> Select "Prefer not to disclose" when available, or ask the user.

## Multi-Page Navigation

Many applications have multiple steps (e.g., "Personal Info" -> "Experience" -> "Education" -> "Review"):

1. After filling each page, look for "Next", "Continue", or "Save & Continue" buttons.
2. Click to proceed to the next step.
3. Repeat the form filling process for each new page.
4. **Take a snapshot** after filling each page to verify.

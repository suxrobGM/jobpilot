# Configuration

All configuration lives in `profile.json` at the project root. Copy the template to get started:

```bash
cp profile.example.json profile.json
```

Your `profile.json` is gitignored - credentials never leave your machine.

## Profile Structure

```json
{
  "personal": {
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "phone": "(555) 123-4567",
    "website": "https://janedoe.dev",
    "linkedin": "https://linkedin.com/in/janedoe",
    "github": "https://github.com/janedoe",
    "resumePath": "/path/to/your/resume.pdf"
  },
  "workAuthorization": { ... },
  "eeo": { ... },
  "address": { ... },
  "credentials": { ... },
  "jobBoards": [ ... ],
  "autopilot": { ... }
}
```

## Resume

Set `personal.resumePath` to your resume file (PDF, DOCX, LaTeX, or plain text). All skills read it at runtime to understand your background. If you skip this, skills will ask on first run.

## Credentials

The `credentials` section stores default login details. Each skill looks up credentials in this order:

1. Board-specific: the matching `jobBoards[]` entry's `email`/`password`
2. Fallback: `credentials.default`

```json
"credentials": {
  "default": {
    "email": "jane@example.com",
    "password": "your-password"
  }
}
```

## Job Boards

The `jobBoards` array controls which boards are searched and how credentials are matched during apply. Add any job board by appending a new entry -- no code changes needed.

```json
"jobBoards": [
  {
    "name": "LinkedIn",
    "domain": "linkedin.com",
    "searchUrl": "https://www.linkedin.com/jobs/search/",
    "type": "search",
    "enabled": true,
    "email": "",
    "password": ""
  },
  {
    "name": "Greenhouse",
    "domain": "greenhouse.io",
    "type": "ats",
    "enabled": true,
    "email": "",
    "password": ""
  }
]
```

| Field | Required | Description |
| ----- | -------- | ----------- |
| `name` | Yes | Display name |
| `domain` | Yes | Used for credential matching during apply |
| `searchUrl` | For search boards | URL to navigate for job search |
| `type` | Yes | `"search"` (searchable boards) or `"ats"` (apply-only platforms like Greenhouse, Lever, Workday) |
| `enabled` | Yes | `true` / `false` |
| `email`, `password` | No | Board-specific credentials (falls back to `credentials.default`) |

## Autopilot Settings

Controls the behavior of the `/autopilot` batch application skill.

```json
"autopilot": {
  "minMatchScore": 6,
  "maxApplicationsPerRun": 10,
  "confirmMode": "batch",
  "skipCompanies": ["CurrentEmployer Inc"],
  "skipTitleKeywords": ["intern", "principal"],
  "defaultStartDate": "2 weeks notice"
}
```

| Setting | Default | Description |
| ------- | ------- | ----------- |
| `minMatchScore` | 6 | Minimum fit score (1-10) to qualify |
| `maxApplicationsPerRun` | 10 | Max applications per run |
| `confirmMode` | `"batch"` | `"batch"` = review list before applying. `"auto"` = skip confirmation when all jobs score >= 6 |
| `skipCompanies` | `[]` | Company names to always skip |
| `skipTitleKeywords` | `[]` | Title keywords to filter out |
| `defaultStartDate` | `"2 weeks notice"` | Default answer for start date fields |

## Work Authorization

Auto-fills visa and sponsorship questions on application forms.

```json
"workAuthorization": {
  "usAuthorized": true,
  "requiresSponsorship": false,
  "visaStatus": "OPT",
  "optExtension": "STEM OPT"
}
```

| Field | Description |
| ----- | ----------- |
| `usAuthorized` | "Are you authorized to work in the US?" |
| `requiresSponsorship` | "Will you now or in the future require sponsorship?" |
| `visaStatus` | Current visa type (e.g., `"OPT"`, `"H-1B"`, `"Green Card"`, `"US Citizen"`) |
| `optExtension` | OPT extension details if applicable (e.g., `"STEM OPT"`) |

## EEO / Diversity Questions

Auto-fills gender, race, ethnicity, veteran status, and disability questions on application forms. Set each field to your answer or `"Prefer not to disclose"`.

```json
"eeo": {
  "gender": "Prefer not to disclose",
  "race": "Prefer not to disclose",
  "ethnicity": "Prefer not to disclose",
  "hispanicOrLatino": "Prefer not to disclose",
  "veteranStatus": "Prefer not to disclose",
  "disabilityStatus": "Prefer not to disclose"
}
```

## Browser Permissions

To avoid being prompted for permission on every browser action, add to `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__plugin_jobpilot_playwright__*"
    ]
  }
}
```

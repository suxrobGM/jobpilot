# JobPilot

A Claude Code plugin that automates job applications, generates cover letters and proposals, and preps you for interviews -- all powered by your resume.

## Skills

| Skill | Command | Description |
|-------|---------|-------------|
| **Apply** | `/jobpilot:apply-job <url>` | Auto-fill job application forms via Playwright browser automation |
| **Cover Letter** | `/jobpilot:cover-letter <job_desc>` | Generate a tailored cover letter |
| **Upwork Proposal** | `/jobpilot:upwork-proposal <job_desc>` | Generate a concise Upwork proposal |
| **Search** | `/jobpilot:search-job <query>` | Search job boards and rank results by qualification fit |
| **Interview** | `/jobpilot:interview <job_desc>` | Generate interview prep Q&A (behavioral, technical, system design) |
| **Autopilot** | `/jobpilot:autopilot <query>` | Autonomously search and apply to jobs in batch with progress tracking |
| **Humanizer** | `/jobpilot:humanizer <text>` | Remove AI writing patterns for natural tone |

## Installation

### From marketplace

```bash
claude plugin install jobpilot
```

### Local development

```bash
git clone --recursive https://github.com/suxrobgm/jobpilot.git
claude --plugin-dir ./jobpilot
```

> Use `--recursive` to pull the humanizer submodule.

## Setup

### 1. Create your profile

```bash
cp profile.example.json profile.json
```

Edit `profile.json` with your personal info, address, and credentials:

```json
{
  "personal": {
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "phone": "(555) 123-4567",
    "resumePath": "/path/to/your/resume.pdf"
  },
  "address": {
    "street": "123 Main St",
    "city": "Portland",
    "state": "ME",
    "zipCode": "04101",
    "country": "United States"
  },
  "credentials": {
    "default": {
      "email": "jane@example.com",
      "password": "your-password"
    }
  },
  "jobBoards": [
    { "name": "LinkedIn", "domain": "linkedin.com", "searchUrl": "https://www.linkedin.com/jobs/search/", "type": "search", "enabled": true, "email": "", "password": "" },
    { "name": "Indeed", "domain": "indeed.com", "searchUrl": "https://www.indeed.com/jobs", "type": "search", "enabled": true, "email": "", "password": "" }
  ]
}
```

`profile.json` is gitignored -- your credentials never leave your machine.

### 2. Add your resume

Set `personal.resumePath` in `profile.json` to the path of your resume file (PDF, LaTeX, DOCX, or plain text). Skills read it at runtime to understand your background.

Alternatively, skip this step -- skills will ask for the path on first run and save it.

### 3. Configure job boards (optional)

The `jobBoards` array controls which boards are searched and how credentials are matched during apply:

- Each entry has a `name`, `domain`, `type`, `enabled`, and optional `email`/`password`
- Set `type: "search"` for boards with job search pages (requires `searchUrl`), or `type: "ats"` for apply-only platforms (Greenhouse, Lever, Workday)
- Set `enabled: true/false` to include/exclude boards
- Add any new board by appending an entry to the array -- no code changes needed

### 4. Allow browser permissions (recommended)

To avoid being prompted for permission on every browser action, add the following to `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__plugin_jobpilot_playwright__*"
    ]
  }
}
```

### 5. Configure autopilot (optional)

Add an `autopilot` section to `profile.json` to control batch application behavior:

```json
"autopilot": {
  "minMatchScore": 6,
  "maxApplicationsPerRun": 10,
  "confirmMode": "batch",
  "skipCompanies": [],
  "skipTitleKeywords": ["intern", "principal"],
  "defaultStartDate": "2 weeks notice"
}
```

| Setting | Default | Description |
| ------- | ------- | ----------- |
| `minMatchScore` | 6 | Minimum fit score (1-10) to qualify for application |
| `maxApplicationsPerRun` | 10 | Max jobs to apply to per run (hard cap: 25) |
| `confirmMode` | "batch" | `"batch"` = review list before applying. `"auto"` = skip confirmation when all jobs score >= 8 |
| `skipCompanies` | [] | Company names to always skip |
| `skipTitleKeywords` | [] | Title keywords to filter out |
| `defaultStartDate` | "2 weeks notice" | Default answer for start date fields |

## Usage Examples

```bash
# Apply to a job (paste URL or job page content)
/jobpilot:apply-job https://boards.greenhouse.io/company/jobs/12345

# Generate a cover letter
/jobpilot:cover-letter We're looking for a senior full-stack developer...

# Write an Upwork proposal
/jobpilot:upwork-proposal Need a React/Node developer to build a dashboard...

# Search for jobs
/jobpilot:search-job "senior fullstack developer Portland ME remote"

# Prep for an interview
/jobpilot:interview We're hiring a backend engineer to work on our API platform...

# Autopilot: search and apply to matching jobs autonomously
/jobpilot:autopilot "senior fullstack developer Portland ME remote"

# Resume an interrupted autopilot run
/jobpilot:autopilot "resume"

# Retry failed applications from a previous run
/jobpilot:autopilot "retry-failed 2026-03-22T14-30-00_senior-fullstack-developer"
```

## How It Works

- **Apply** uses Playwright browser automation to navigate job sites, log in with your credentials, and fill form fields using your resume data. It always asks for confirmation before submitting.
- **Cover Letter** and **Upwork Proposal** analyze the job description, match it against your resume, write a draft, then pass it through the humanizer for natural tone.
- **Search** browses your enabled job boards, collects results, and scores each one against your resume.
- **Interview** generates role-specific questions with suggested answers drawn from your actual experience.
- **Autopilot** combines search and apply into a single autonomous workflow. It searches your enabled boards, scores results against your resume, presents a batch for one-time approval, then applies to every approved job without further prompts. Progress is saved to `runs/` so interrupted runs can be resumed.

## Credits

- [Humanizer](https://github.com/blader/humanizer) by blader -- included as a git submodule (MIT License)

## License

MIT

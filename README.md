# JobPilot

A Claude Code plugin that automates job applications, generates cover letters and proposals, and preps you for interviews -- all powered by your resume.

## Skills

| Skill | Command | Description |
|-------|---------|-------------|
| **Apply** | `/jobpilot:apply <url>` | Auto-fill job application forms via Playwright browser automation |
| **Cover Letter** | `/jobpilot:cover-letter <job_desc>` | Generate a tailored cover letter |
| **Upwork Proposal** | `/jobpilot:upwork-proposal <job_desc>` | Generate a concise Upwork proposal |
| **Search** | `/jobpilot:search <query>` | Search job boards and rank results by qualification fit |
| **Interview** | `/jobpilot:interview <job_desc>` | Generate interview prep Q&A (behavioral, technical, system design) |
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
  "jobBoards": {
    "linkedin.com": { "enabled": true, "email": "", "password": "" },
    "indeed.com": { "enabled": true, "email": "", "password": "" }
  }
}
```

`profile.json` is gitignored -- your credentials never leave your machine.

### 2. Add your resume

Set `personal.resumePath` in `profile.json` to the path of your resume file (PDF, LaTeX, DOCX, or plain text). Skills read it at runtime to understand your background.

Alternatively, skip this step -- skills will ask for the path on first run and save it.

### 3. Configure job boards (optional)

The `jobBoards` section controls which boards the `search` skill uses:

- Set `enabled: true/false` to include/exclude boards
- Add board-specific credentials for login
- The `apply` skill also uses these credentials when filling forms on matching domains

## Usage Examples

```bash
# Apply to a job (paste URL or job page content)
/jobpilot:apply https://boards.greenhouse.io/company/jobs/12345

# Generate a cover letter
/jobpilot:cover-letter We're looking for a senior full-stack developer...

# Write an Upwork proposal
/jobpilot:upwork-proposal Need a React/Node developer to build a dashboard...

# Search for jobs
/jobpilot:search "senior fullstack developer Portland ME remote"

# Prep for an interview
/jobpilot:interview We're hiring a backend engineer to work on our API platform...
```

## How It Works

- **Apply** uses Playwright browser automation to navigate job sites, log in with your credentials, and fill form fields using your resume data. It always asks for confirmation before submitting.
- **Cover Letter** and **Upwork Proposal** analyze the job description, match it against your resume, write a draft, then pass it through the humanizer for natural tone.
- **Search** browses your enabled job boards, collects results, and scores each one against your resume.
- **Interview** generates role-specific questions with suggested answers drawn from your actual experience.

## Credits

- [Humanizer](https://github.com/blader/humanizer) by blader -- included as a git submodule (MIT License)

## License

MIT

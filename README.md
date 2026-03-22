# JobPilot

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin that automates your job search end-to-end: find matching positions, auto-fill applications, generate cover letters, write proposals, and prep for interviews - all powered by your resume.

![Autopilot batch confirmation - jobs scored and ranked against your resume](docs/images/batch-confirmation.png)

## What It Does

| Skill | Command | What it does |
| ----- | ------- | ------------ |
| **Autopilot** | `/autopilot <query>` | Search boards, score matches, and apply to jobs autonomously in batch |
| **Apply** | `/apply-job <url>` | Auto-fill a single job application form via browser automation |
| **Search** | `/search-job <query>` | Search job boards and rank results by qualification fit |
| **Cover Letter** | `/cover-letter <job_desc>` | Generate a tailored cover letter matched to your experience |
| **Upwork Proposal** | `/upwork-proposal <job_desc>` | Generate a concise, client-focused Upwork proposal |
| **Interview Prep** | `/interview <job_desc>` | Generate Q&A prep (behavioral, technical, system design) |
| **Humanizer** | `/humanizer <text>` | Rewrite text to remove AI patterns and sound natural |

## Quick Start

### 1. Install

```bash
git clone --recursive https://github.com/suxrobgm/jobpilot.git
claude --plugin-dir ./jobpilot
```

![Launching JobPilot with claude --plugin-dir](docs/images/launch.png)

> Use `--recursive` to pull the [humanizer](https://github.com/blader/humanizer) submodule. Once available on the marketplace: `claude plugin install jobpilot`

### 2. Set up your profile

```bash
cp profile.example.json profile.json
```

Edit `profile.json` with your personal info, resume path, credentials, and job board config. See [Configuration](docs/configuration.md) for the full reference.

### 3. Allow browser permissions (recommended)

Add to `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__plugin_jobpilot_playwright__*"
    ]
  }
}
```

## Usage

```bash
# Autopilot: search and apply to matching jobs autonomously
/autopilot "senior fullstack developer Portland ME remote"

# Apply to a single job
/apply-job https://boards.greenhouse.io/company/jobs/12345

# Search for jobs
/search-job "software engineer remote"

# Generate a cover letter
/cover-letter We are looking for a senior full-stack developer...

# Write an Upwork proposal
/upwork-proposal Need a React/Node developer to build a dashboard...

# Prep for an interview
/interview We are hiring a backend engineer for our API platform...

# Resume an interrupted autopilot run
/autopilot "resume"
```

![Auto-filling a job application form with profile data](docs/images/form-autofill.png)

![Autopilot run summary showing applied, failed, and skipped jobs](docs/images/run-summary.png)

## Documentation

- [Configuration](docs/configuration.md) - profile setup, job boards, autopilot settings, work authorization, EEO
- [How It Works](docs/how-it-works.md) - architecture, skill details, project structure

## Credits

- [Humanizer](https://github.com/blader/humanizer) by blader - included as a git submodule (MIT License)

## License

MIT

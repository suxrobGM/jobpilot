# JobPilot

A local-first AI job-application app. A Next.js + SQLite web UI owns all
state and embeds an interactive Claude Code or Codex terminal session that
runs the JobPilot provider skills against real job boards via Playwright.

## Components

- **Web app** ([src/web/](src/web/)) - `http://localhost:8000`. Owns
  profile, credentials, resumes, job boards, applications, runs, and the
  batch queue. It embeds an xterm.js terminal panel and exposes "Run
  autopilot" / "Run apply" buttons that inject slash commands.
- **JobPilot.Terminal** ([src/JobPilot.Terminal/](src/JobPilot.Terminal/)) -
  `http://localhost:8001`. .NET 10 ASP.NET Core process that owns one active
  provider PTY (winpty) and bridges it to the web UI over WebSocket. The
  terminal drawer can switch between Claude Code and Codex.
- **Shared JobPilot skills**
  ([src/jobpilot-skills/](src/jobpilot-skills/)) - provider-neutral workflow
  instructions for search, apply, autopilot, batch apply, and writing tasks.
- **Claude Code plugin**
  ([src/jobpilot-claude-plugin/](src/jobpilot-claude-plugin/)) - thin Claude
  wrappers plus Playwright MCP config. Direct run:
  `claude --plugin-dir src/jobpilot-claude-plugin`.
- **Codex plugin**
  ([src/jobpilot-codex-plugin/](src/jobpilot-codex-plugin/)) - thin Codex
  wrappers plus Playwright MCP config. Direct run from the repo root:
  `codex --no-alt-screen -C .`.

## Quick Start

```bash
git clone https://github.com/suxrobgm/jobpilot.git
cd jobpilot
bun install
bun run start   # web :8000 + terminal :8001 (auto-runs migrations + seed)
```

Open `http://localhost:8000` and toggle the Terminal panel.

## Skills

Reusable skill workflows are markdown prompts under
[src/jobpilot-skills/skills/](src/jobpilot-skills/skills/). Provider plugins
wrap those workflows with provider-specific command names.

Claude commands use `/jobpilot:<skill>`, for example:

```text
/jobpilot:autopilot senior typescript remote
```

Codex commands use `$jobpilot-<skill>`, for example:

```text
$jobpilot-autopilot senior typescript remote
```

| Skill             | Purpose                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `apply`           | Apply to a single URL (with fit review) or drain the `/queue` page.  |
| `autopilot`       | Search enabled boards, score, batch-approve, and apply autonomously. |
| `search`          | Search boards and rank results without applying.                     |
| `cover-letter`    | Draft a tailored cover letter and run it through the humanizer.      |
| `upwork-proposal` | Draft a tailored Upwork proposal.                                    |
| `interview`       | Prepare behavioral, technical, and company-research interview notes. |
| `scan-inbox`      | Classify new mail, fuzzy-match to applications, propose stage moves. |
| `get-code`        | Pull the latest verification code or magic link for a board domain.  |

## Email Integration (Gmail)

JobPilot can read your Gmail inbox to track recruiter replies and auto-fill
verification codes during login. Setup:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an OAuth 2.0 Client ID (type: **Web application**).
2. Add `http://localhost:8000/api/email/oauth/callback` as an authorized
   redirect URI.
3. Enable the **Gmail API** for the project under "APIs & Services".
4. Copy `Client ID` and `Client secret` into `src/web/.env`:

   ```env
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

5. Add the **`gmail.readonly`** scope to the consent screen. Google
   reorganized this UI — it now lives at
   [Google Auth Platform → Data access](https://console.cloud.google.com/auth/scopes)
   Click **Add or remove scopes**, search for `gmail.readonly`, tick the
   Gmail API row marked **Sensitive**, then **Save**. Without this the
   token gets issued but Gmail API returns 403 "insufficient scopes".
6. While in Testing mode, add your Gmail address under
   [Audience → Test users](https://console.cloud.google.com/auth/audience).
   Keep the app in Testing — `gmail.readonly` is a Sensitive scope, and
   publishing requires a paid third-party CASA security audit. Testing
   mode allows 100 test users; refresh tokens expire after 7 days so
   you'll need to reconnect weekly.
7. Restart `bun run dev`, open `/profile` → **Email** tab → **Connect Gmail**.

The scope is `gmail.readonly` — JobPilot never sends or deletes mail. The
account is stored as a singleton row in `EmailAccount` (refresh token kept
locally in `src/web/prisma/dev.db`).

**Troubleshooting**

- **"Access blocked: app has not completed the Google verification
  process"** — your Gmail isn't on the Test users list. Add it under
  **Audience → Test users**.
- **`403 PERMISSION_DENIED — Request had insufficient authentication
scopes`** — the `gmail.readonly` scope isn't on the consent screen.
  Add it under **Data access**, then **Disconnect** and reconnect in
  `/profile` so a new token with the right scope is issued.
- **Google 500 after publishing** — you published an app that uses a
  Sensitive scope. Go back to Testing mode under
  **Audience → Publishing status → Back to testing**.

## Documentation

- [docs/architecture.md](docs/architecture.md) - architecture walk-through.
- [docs/self-hosting.md](docs/self-hosting.md) - operations and configuration.
- [CLAUDE.md](CLAUDE.md) - contributor and agent context.

## Tech Stack

| Layer              | Choice                                         |
| ------------------ | ---------------------------------------------- |
| Runtime            | Bun 1.3                                        |
| Framework          | Next.js 16 (App Router, RSC, typed routes)     |
| UI                 | MUI 9 + MUI X DataGrid                         |
| Forms              | TanStack Form 1 + Zod v4                       |
| Server state       | TanStack Query 5                               |
| Database           | SQLite via Prisma 7 + `@prisma/adapter-libsql` |
| Terminal host      | .NET 10 ASP.NET Core, winpty via Quick.PtyNet  |
| Browser automation | Playwright via the Playwright MCP server       |

## License

MIT. The shared humanizer skill is based on the bundled upstream humanizer
package under
[src/jobpilot-claude-plugin/skills/humanizer/](src/jobpilot-claude-plugin/skills/humanizer/),
which ships with its own LICENSE file.

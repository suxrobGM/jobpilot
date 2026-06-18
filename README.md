# JobPilot

A local-first AI job-application app. An Elysia + PostgreSQL API owns all
state, a Next.js web UI talks to it, and an embedded Claude Code or Codex
terminal session runs the JobPilot provider skills against real job boards via
Playwright.

## Components

- **Web app** ([apps/web/](apps/web/)) - `http://localhost:8000`. The Next.js
  UI for profile, credentials, resumes, job boards, applications, campaigns,
  and the batch queue. It embeds an xterm.js terminal panel and exposes "Run
  autopilot" / "Run apply" buttons that inject slash commands.
- **API** ([apps/api/](apps/api/)) - `http://localhost:8002`. Bun + Elysia +
  Prisma backend that owns all persistence (PostgreSQL; resumes under
  `apps/api/storage/`) and serves the typed `/api/*` surface (Swagger at
  `/swagger`).
- **JobPilot.Terminal** ([apps/terminal/](apps/terminal/)) -
  `http://localhost:8001`. .NET 10 ASP.NET Core process that owns one active
  provider PTY (ConPTY) and bridges it to the web UI over WebSocket. The
  terminal drawer can switch between Claude Code and Codex.
- **Plugin** ([plugin/](plugin/)) - one provider-neutral plugin loaded by both
  providers, with no generation step. It holds the hand-authored skill pack
  (`plugin/skills/<name>/SKILL.md` plus shared setup, auth, browser-tips, and
  form-filling docs under `plugin/skills/shared/`), the Playwright MCP config
  (`plugin/.mcp.json`), and a manifest per provider
  (`plugin/.claude-plugin/plugin.json`, `plugin/.codex-plugin/plugin.json` —
  both name the plugin `jobpilot`).
  - Claude: `claude --plugin-dir plugin`.
  - Codex: auto-discovered via
    [.agents/plugins/marketplace.json](.agents/plugins/marketplace.json)
    (`source.path: ./plugin`) when launched at the repo root
    (`codex --no-alt-screen -C .`). Enable it once from Codex's `/plugin` menu.

## Quick Start

```bash
git clone https://github.com/suxrobgm/jobpilot.git
cd jobpilot
bun install
bun run db:up    # starts the local PostgreSQL container (Docker)
bun run db:setup # generates the Prisma client, runs migrations, seeds default data
bun run dev      # web :8000 + api :8002 + terminal :8001
```

Open `http://localhost:8000` and toggle the Terminal panel.

## Skills

Skill workflows live under [plugin/skills/](plugin/skills/) as `<name>/SKILL.md`
directories, edited directly as the single source of truth for both providers.
Shared docs (setup, auth, browser-tips, form-filling) live under
[plugin/skills/shared/](plugin/skills/shared/). There is no build step.

Claude commands use `/jobpilot:<skill>`, for example:

```text
/jobpilot:auto-apply senior typescript remote
```

Codex commands use `$<skill>`, for example:

```text
$auto-apply senior typescript remote
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

JobPilot reads your Gmail inbox (to track recruiter replies and auto-fill
verification codes during login) and sends outreach emails and replies on
your behalf. Setup:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an OAuth 2.0 Client ID (type: **Web application**).
2. Add `http://localhost:8000/api/email/oauth/callback` as an authorized
   redirect URI.
3. Enable the **Gmail API** for the project under "APIs & Services".
4. Copy `Client ID` and `Client secret` into `apps/api/.env`:

   ```env
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

5. Add the **`gmail.readonly`** and **`gmail.send`** scopes to the consent
   screen. Google reorganized this UI — it now lives at
   [Google Auth Platform → Data access](https://console.cloud.google.com/auth/scopes)
   Click **Add or remove scopes**, search for `gmail.readonly` and
   `gmail.send`, tick both Gmail API rows (each marked **Sensitive**), then
   **Save**. `readonly` lets JobPilot track replies and read verification
   codes; `send` lets it send outreach emails and replies. Without `readonly`
   the Gmail API returns 403 "insufficient scopes"; without `send` the mailbox
   connects read-only and outreach can't send.
6. While in Testing mode, add your Gmail address under
   [Audience → Test users](https://console.cloud.google.com/auth/audience).
   Keep the app in Testing — both Gmail scopes are Sensitive, and
   publishing requires a paid third-party CASA security audit. Testing
   mode allows 100 test users; refresh tokens expire after 7 days so
   you'll need to reconnect weekly.
7. Restart `bun run dev`, open `/settings` → **Email** section → **Connect
   Gmail**.

The scopes are `gmail.readonly` and `gmail.send` — JobPilot reads your mail and
sends outreach emails and replies on your behalf, but never deletes mail. The
account is stored as a singleton row in `EmailAccount` (refresh token kept
locally in your PostgreSQL database).

**Troubleshooting**

- **"Access blocked: app has not completed the Google verification
  process"** — your Gmail isn't on the Test users list. Add it under
  **Audience → Test users**.
- **`403 PERMISSION_DENIED — Request had insufficient authentication
scopes`** — a required Gmail scope (`gmail.readonly` or `gmail.send`) isn't
  on the consent screen. Add both under **Data access**, then **Disconnect**
  and reconnect in `/settings` → **Email** so a new token with the right
  scopes is issued.
- **Mailbox connects read-only / outreach can't send** — the token was issued
  without `gmail.send`. Add the `gmail.send` scope under **Data access**, then
  use **Reconnect to enable sending** in `/settings` → **Email**.
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
| Database           | PostgreSQL via Prisma 7 + `@prisma/adapter-pg`  |
| Terminal host      | .NET 10 ASP.NET Core, ConPTY via Quick.PtyNet  |
| Browser automation | Playwright via the Playwright MCP server       |

## License

MIT. The shared humanizer skill is based on the bundled upstream humanizer
package under [plugin/skills/humanizer/](plugin/skills/humanizer/), which
ships with its own LICENSE file.

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
  (`plugin/.claude-plugin/plugin.json`, `plugin/.codex-plugin/plugin.json` -
  both name the plugin `jobpilot`).
  - **Worker subagents** ([plugin/agents/](plugin/agents/)) - `job-worker`
    (per-job score/apply) and `outreach-worker` (contact discovery + compose)
    run the heavy browser/web work in an isolated context so long campaigns
    don't fill the main conversation and trigger compaction. Claude
    auto-discovers them from `plugin/agents/`; Codex definitions live at
    [.codex/agents/](.codex/agents/) (repo root) and point back at the same
    `plugin/agents/*.md` procedures. Any runtime that can't load custom
    subagents simply runs those procedures inline - same behavior, no isolation
    (see `plugin/skills/shared/setup.md` → "Worker subagents").
  - Claude: `claude --plugin-dir plugin`.
  - Codex: auto-discovered via
    [.agents/plugins/marketplace.json](.agents/plugins/marketplace.json)
    (`source.path: ./plugin`) when launched at the repo root
    (`codex --no-alt-screen -C .`). Enable it once from Codex's `/plugin` menu.
    For Codex subagent isolation outside the repo, copy
    [.codex/agents/](.codex/agents/) into `~/.codex/agents/`.

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

### Remote database (SSH tunnel)

To point the API at a remote PostgreSQL, open an SSH tunnel and target it
locally. Set the `SSH_TUNNEL_*` / `REMOTE_DB_*` / `LOCAL_DB_PORT` vars in
[apps/api/.env](apps/api/.env) (see [apps/api/.env.example](apps/api/.env.example)),
then:

```bash
bun run db:tunnel   # binds localhost:5433 -> remote db through the SSH host; Ctrl+C to close
```

With the tunnel up, set `DATABASE_URL=postgresql://<user>:<pass>@localhost:5433/<db>`
in [apps/api/.env](apps/api/.env). `db:setup`, `db:studio`, and the API all then
run against the remote DB. Set `REMOTE_DB_HOST` to `127.0.0.1` when the database
runs on the SSH server itself, or to its private host when tunneling via a bastion.

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
your behalf. Each user connects Gmail with **their own** Google OAuth client -
JobPilot ships no shared client, so the app itself needs no Google verification
or CASA security audit. Setup (once per user):

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create a new project, then an OAuth 2.0 Client ID (type: **Web application**).
2. Enable the **Gmail API** for the project under "APIs & Services".
3. In JobPilot, open **Settings → Email** and copy the **redirect URI** shown
   there; add it as an authorized redirect URI on your OAuth client (defaults to
   `http://localhost:8002/api/email/oauth/callback` in dev; in production it's
   your deployment's API callback URL).
4. Add the **`gmail.readonly`** and **`gmail.send`** scopes to the consent
   screen. Google reorganized this UI - it now lives at
   [Google Auth Platform → Data access](https://console.cloud.google.com/auth/scopes)
   Click **Add or remove scopes**, search for `gmail.readonly` and
   `gmail.send`, tick both Gmail API rows, then **Save**. `readonly` lets
   JobPilot track replies and read verification codes; `send` lets it send
   outreach emails and replies. Without `readonly` the Gmail API returns 403
   "insufficient scopes"; without `send` the mailbox connects read-only and
   outreach can't send.
5. Keep **your** app in Testing mode and add your Gmail address under
   [Audience → Test users](https://console.cloud.google.com/auth/audience).
   Because it's your own project with you as the sole test user, no
   verification/CASA is required. Note: Testing-mode refresh tokens expire
   after ~7 days, so you'll reconnect periodically - publish your own app
   (still no verification under Google's 100-user test limit) to avoid that.
6. Back in **Settings → Email**, paste your **Client ID** and **Client
   secret**, **Save**, then **Connect Gmail**.

The scopes are `gmail.readonly` and `gmail.send` - JobPilot reads your mail and
sends outreach emails and replies on your behalf, but never deletes mail. Your
OAuth client id/secret are stored encrypted per-user (the secret never leaves
the server); the connected account is one row per profile in `EmailAccount`.

**Troubleshooting**

- **"Access blocked: app has not completed the Google verification
  process"** - your Gmail isn't on the Test users list. Add it under
  **Audience → Test users**.
- **`403 PERMISSION_DENIED - Request had insufficient authentication
scopes`** - a required Gmail scope (`gmail.readonly` or `gmail.send`) isn't
  on the consent screen. Add both under **Data access**, then **Disconnect**
  and reconnect in `/settings` → **Email** so a new token with the right
  scopes is issued.
- **Mailbox connects read-only / outreach can't send** - the token was issued
  without `gmail.send`. Add the `gmail.send` scope under **Data access**, then
  use **Reconnect to enable sending** in `/settings` → **Email**.
- **Google 500 after publishing** - you published an app that uses a
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

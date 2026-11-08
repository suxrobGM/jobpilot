---
name: setup
description: Install, start, or update the JobPilot agent terminal on this machine, then open the dashboard. Run this first after installing the plugin in Claude Code or Codex.
---

# JobPilot setup

Make sure the local terminal host is installed, current and running, then send the user to the
dashboard, where the agent signs in. This skill needs no token.

```bash
JOBPILOT_WEB="${JOBPILOT_WEB:-https://jobpilot.suxrobgm.net}"
```

## 1. Already inside the host?

`JOBPILOT_API_TOKEN` set means this session runs inside the agent terminal. Nothing to install:

> You're connected to JobPilot. Run the `search` skill to find jobs, `auto-apply` to apply, or
> manage everything at $JOBPILOT_WEB.

## 2. Probe the host

```bash
node -e "fetch('http://localhost:4102/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
```

- Answers: it is running. Go to step 5.
- Refused, but installed (`jobpilot` on `PATH`, or `~/.jobpilot/jobpilot` exists): step 4.
- Not installed: step 3, then step 4.

## 3. Install

Ask before running a remote install script, then run the one for the user's OS. It installs into
`~/.jobpilot` and adds it to `PATH`.

- Windows (PowerShell):

  ```powershell
  irm https://raw.githubusercontent.com/suxrobGM/jobpilot/main/apps/terminal/install.ps1 | iex
  ```

- macOS / Linux:

  ```bash
  curl -fsSL https://raw.githubusercontent.com/suxrobGM/jobpilot/main/apps/terminal/install.sh | bash
  ```

## 4. Start

Start it yourself, detached so it outlives this session, by full path from the install dir:

- Windows (PowerShell):

  ```powershell
  Start-Process "$env:USERPROFILE\.jobpilot\jobpilot.exe" -WorkingDirectory "$env:USERPROFILE\.jobpilot" -WindowStyle Hidden
  ```

- macOS / Linux:

  ```bash
  (cd "$HOME/.jobpilot" && nohup ./jobpilot >"$HOME/.jobpilot/host.log" 2>&1 & disown)
  ```

Poll for up to 30 seconds:

- Windows: `1..30 | %{ try { irm http://localhost:4102/healthz; break } catch { sleep 1 } }`
- macOS / Linux: `for i in $(seq 1 30); do node -e "fetch('http://localhost:4102/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))" && break; sleep 1; done`

Healthy: step 6 (a fresh start updates itself). Still refused: read the log
(`~/.jobpilot/host.log`, or the console on Windows). Port 4102 in use means a stale instance: stop
it (`Get-Process jobpilot | Stop-Process -Force` / `pkill -x jobpilot`) and repeat step 4.
Otherwise report the error and ask the user to start `jobpilot` by hand.

## 5. Update

Only when the host was already running.

- **Host and skills** ship together and update on restart. If the latest `v*` release at
  `https://api.github.com/repos/suxrobGM/jobpilot/releases` is newer than `hostVersion` from
  `/healthz`, stop the host (`Get-Process jobpilot -ErrorAction SilentlyContinue | Stop-Process
  -Force` / `pkill -x jobpilot`, exact name), repeat step 4, and confirm the new version.
  Restarting ends the active session, so skip it when current.
- **This setup skill** comes from the provider marketplace. If it is stale: in Claude Code,
  `/plugin marketplace update sukhrob-claude-plugins` then `/reload-plugins`; in Codex,
  `codex plugin marketplace upgrade sukhrob-codex-plugins` then
  `codex plugin add jobpilot@sukhrob-codex-plugins`. Then start a new session and run `setup`
  again.

## 6. Open the dashboard

The agent signs in from the dashboard, never from this session:

> JobPilot is ready. Open $JOBPILOT_WEB, sign in, and launch the agent from the dashboard. It
> connects to your local terminal on its own. From there, `search` for jobs or `auto-apply`.

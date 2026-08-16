---
name: setup
description: Install, start, or update the JobPilot agent terminal on this machine, then open the dashboard. Run this first after installing the plugin in Claude Code or Codex.
---

# JobPilot Setup

Onboarding + update entry point: ensure the local terminal host is installed, current, and running, then send the user to the dashboard where the agent signs in. Safe to run without a token - do not defer to any auth gate.

```bash
JOBPILOT_WEB="${JOBPILOT_WEB:-https://jobpilot.suxrobgm.net}"
```

## 1. Already inside the terminal host?

If `JOBPILOT_API_TOKEN` is set, this session is already running inside the agent terminal - nothing to install. Confirm and stop:

> You're connected to JobPilot. Run the `search` skill to find jobs, `auto-apply` to run a campaign, or manage everything at $JOBPILOT_WEB.

## 2. Probe the host

```bash
curl -fsS http://localhost:4102/healthz
```

- Reachable → already running; go to step 5 to check for updates.
- Refused but installed (`jobpilot` on `PATH`, or `~/.jobpilot/jobpilot` exists) → go to step 4.
- Not found → install it (step 3), then start it (step 4).

## 3. Install the terminal host

Confirm with the user before running a remote install script, then run the one-liner for their OS:

- **Windows (PowerShell):**

  ```powershell
  irm https://raw.githubusercontent.com/suxrobGM/jobpilot/main/apps/terminal/install.ps1 | iex
  ```

- **macOS / Linux:**

  ```bash
  curl -fsSL https://raw.githubusercontent.com/suxrobGM/jobpilot/main/apps/terminal/install.sh | bash
  ```

It downloads the latest release into `~/.jobpilot` and adds it to `PATH`.

## 4. Start the host

Start it yourself - don't ask the user to. Launch it detached so it outlives this session, by full path and from the install dir:

- **Windows (PowerShell):**

  ```powershell
  Start-Process "$env:USERPROFILE\.jobpilot\jobpilot.exe" -WorkingDirectory "$env:USERPROFILE\.jobpilot" -WindowStyle Hidden
  ```

- **macOS / Linux:**

  ```bash
  (cd "$HOME/.jobpilot" && nohup ./jobpilot >"$HOME/.jobpilot/host.log" 2>&1 & disown)
  ```

Then poll until it answers (up to ~30s):

- **Windows (PowerShell):** `1..30 | %{ try { irm http://localhost:4102/healthz; break } catch { sleep 1 } }`
- **macOS / Linux:** `for i in $(seq 1 30); do curl -fsS http://localhost:4102/healthz && break; sleep 1; done`

- Healthy → continue to step 6 (a fresh start self-updates on launch).
- Still refused after the timeout → check the log (`~/.jobpilot/host.log` on macOS/Linux, console output on Windows). If it says port 4102 is already in use, a stale `jobpilot` instance is running - stop it (`Get-Process jobpilot | Stop-Process -Force` / `pkill -x jobpilot`) and retry step 4. Otherwise report the failure and ask the user to start `jobpilot` manually.

## 5. Update to the latest release

Only when the host was already running (step 2):

- **Terminal host and runtime skills** - they ship together and self-update on restart. If the latest `v*` release (`https://api.github.com/repos/suxrobGM/jobpilot/releases`) is newer than the running `hostVersion` (`/healthz`), restart it and confirm the new version. Restarting ends the active session, so skip it when already current.

  Restart, then re-run step 4's launch + poll:
  - **Windows (PowerShell):** `Get-Process jobpilot -ErrorAction SilentlyContinue | Stop-Process -Force`
  - **macOS / Linux:** `pkill -x jobpilot` (exact name; avoid `-f`, which matches a shell in a `jobpilot` dir)

- **Setup bootstrap** - only this skill lives in the provider marketplace. If its installer procedure is stale, update it with `/plugin marketplace update sukhrob-claude-plugins` then `/reload-plugins` in Claude Code, or `codex plugin marketplace upgrade sukhrob-codex-plugins` followed by `codex plugin add jobpilot@sukhrob-codex-plugins` in a shell for Codex, then start a new session and re-run `setup`.

## 6. Open the dashboard

The agent launches and signs in from the dashboard - never from this session:

> JobPilot is ready. Open $JOBPILOT_WEB, sign in, and launch the agent from the dashboard - it connects to your local terminal automatically. From there, `search` for jobs or `auto-apply` to run a campaign.

## What JobPilot does

Searches job boards, tailors your resume per posting, and applies on your behalf - running on your own Claude/Codex subscription via the local agent. Your data lives in your JobPilot account on the web; the agent talks to it for you.

# JobPilot terminal host

A local .NET process that runs one Claude Code or Codex PTY for the web app and drives the pilot
loop. It holds no cloud state.

## Layout

One folder per feature; namespaces match folders.

| Folder | What it does |
| --- | --- |
| `Hosting/` | DI, middleware, `/healthz`, `/shutdown`, origin allowlist, AOT JSON context. |
| `Install/` | Install layout and the `jobpilot://` scheme. |
| `Install/Updates/` | `HostUpdater` installs a release, `HostRelaunch` restarts on the same port, `HostSelfUpdate` updates on a 426. |
| `Providers/` | Per-CLI launch arguments: `ClaudeProvider`, `Codex/`. |
| `Sessions/` | `TerminalSession` owns the live session; `Pty/` spawns it, `Relay/` bridges WebSockets. |
| `Pilot/` | `PilotLoop` runs cycles, `CycleRunner` runs one, `PilotEventListener` routes API events. |
| `Pilot/Pairing/` | `PairingStore` keeps the paired account in `pilot.json`; `TokenProtection` wraps its token. |
| `Pilot/Agent/` | `PilotAgent` types into the session for a run; `StuckDetector` spots a stuck agent. |
| `Pilot/Api/` | JobPilot API calls and wire records. |
| `Pilot/Telemetry/` | `/v1/logs`: token usage and run steps from the CLI's OTLP logs. |

## Flows

- **Session.** `/sessions/start` prepares the provider workspace, builds the child environment
  (`SessionEnvironment`) and spawns a `PtyProcess`. `TerminalRelay` fans output to every WebSocket
  and keeps a 512 KB replay.
- **Pilot.** While paired, each cycle probes `/api/pilot/activity`, refreshes the task list, and
  either sleeps (no tasks, or the user typed in the last 3 minutes) or starts a run: `/clear`, then
  the pilot skill with the run id, until `run.finished`. Stuck runs escalate check-in → skip →
  restart; three stuck runs or early exits in a row pause for 30 minutes. After a run the host
  posts token usage (`UsageMeter`) and reports the cycle. `StepRecorder` posts short step labels
  every 2 seconds; they never carry typed values, page text, query strings or full commands.
- **Update.** `HostUpdater` swaps the executable and `plugin/` (the rest of the install root may be
  user state), then `HostRelaunch` starts the new host. A 426 from the API triggers the same update.

## Shared state

- `TerminalSession.sync` guards the process and provider. A replaced process never reports an exit,
  so a stale exit can't stop a newer session.
- `TerminalRelay.sync` orders replay writes against client registration.
- `PairingStore.sync` guards the pairing and the atomic `pilot.json` replace.
- `PilotLoop.sync` guards the cycle's cancellation source, published before reading settings so an
  unpair either cancels the cycle or is seen by it.

## Invariants

- A requested stop raises one exit and never shows a crash banner.
- `PilotApi` probes and reports never throw except on the caller's cancellation.
- A wake that keeps the pairing never interrupts the agent mid-turn; an unpair does.
- Terminal typing holds new runs, never the one in flight.
- `pilot.json` is DPAPI-protected on Windows and mode `0600` on Unix.

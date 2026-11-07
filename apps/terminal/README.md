# JobPilot terminal host

A local .NET process that runs one Claude Code or Codex PTY for the web app. It owns no cloud state:
it launches the provider with the user's JobPilot API environment and relays raw terminal traffic.

## Layout

Each folder is one feature and holds its endpoints, request and response records, and logic.
Namespaces match folders.

| Folder | What it does |
| --- | --- |
| `Hosting/` | DI and middleware, `/healthz` and `/shutdown`, the origin allowlist, the AOT JSON context. |
| `Install/` | The install layout and the `jobpilot://` scheme. |
| `Install/Updates/` | `HostUpdater` installs a newer GitHub release; `HostRelaunch` passes the port to the relaunched host. |
| `Providers/` | What to launch. `Provider` is the registry; `ClaudeProvider` and `Codex/` hold each CLI's arguments and quirks. |
| `Sessions/` | The live session. `TerminalSession` owns it. `Pty/` wraps one spawned process, `Relay/` bridges WebSockets. |
| `Pilot/` | The autonomous loop: `PilotLoop` runs cycles, `CycleRunner` runs one, `PilotAgent` drives the agent for it. |
| `Pilot/Api/` | Calls to the JobPilot API, its wire records, and the event stream. |
| `Pilot/Telemetry/` | `/v1/logs`: token usage and readable steps from the CLI's OTLP log export. |
| `Pilot/Stuck/` | Spots a stuck agent from its terminal output. |

## Runtime flows

- **Session.** `/sessions/start` calls `TerminalSession.Start`, which prepares the provider's
  workspace (Codex mirrors the bundled skills into `.agents/skills`), builds the `JOBPILOT_*`
  environment, and spawns a new `PtyProcess`. `TerminalRelay` broadcasts output to every WebSocket
  and keeps a 512 KB replay for reconnects.
- **Pilot.** `/pilot/pair` saves the `PilotPairing` to `pilot.json` and `/pilot/unpair` deletes it;
  every change wakes `PilotLoop`, which runs cycles whenever the host is paired. Autopilot is a
  server flag: with it off the task list holds only what the user asked for. Each cycle starts with
  one `/api/pilot/activity` probe, so an unreachable API backs off instead of spending a refresh.
  `CycleRunner` then refreshes the task list. With no tasks it records an idle check on the pilot
  state (no journal entry) and sleeps, so an idle pilot never wakes the model. With tasks it starts
  a run for the top one, unless the user typed into the terminal in the last 3 minutes: then it
  journals one waiting line, reports `heldUntil` in `/healthz`, and sleeps until the hold ends
  (`/pilot/handback` ends it early). Otherwise it starts the run, types `/clear` and the pilot skill with the run id, and waits for the run
  to finish: the `run.finished` event the agent's result publishes, or a poll of the run. A stuck
  run climbs check-in, skip, then restart, and a run with no result is cancelled by the host. The
  host then posts the run's token usage, which `UsageMeter` sums from the CLI's OTLP logs on
  `/v1/logs`, and reports the cycle to `/api/pilot/cycles`, as it does after an idle check. `PilotEventListener` holds the API's event stream open while paired,
  passes `run.finished` to the session, wakes the loop on messages, requests and answered questions,
  and hands `run.interrupt` (Esc, a stop line, then a cancel) and `run.steer` (one sanitized line
  typed into the session) to the session for the run in flight. While a run is open,
  `StepRecorder` reads the same OTLP logs for tool calls, `StepLabels` turns each into a short
  label ("Opened boards.greenhouse.io/acme/jobs/42", "Filled 6 fields", "Updated a job"), and the
  batch goes to `POST /api/pilot/runs/:id/steps` every 2 seconds. Labels never carry typed values,
  page text, query strings or whole commands; tool calls outside a run are never sent.
- **Update.** `HostUpdater` downloads the release, moves the running executable aside, and copies
  the release over the install. `HostRelaunch.Relaunch` starts the new host, which waits for this one
  to release the port. Only the executable and `plugin/` are the updater's; the rest of the install
  root may be user state.

## Shared state

- `TerminalSession.sync` guards the current `PtyProcess` and the active provider. Replacing or
  stopping a session disposes its process, which never reports an exit afterwards, so a stale exit
  cannot stop a newer one.
- `TerminalRelay.sync` orders replay writes against client registration and guards the client map.
- `PairingStore.sync` guards the in-memory pairing and serializes the atomic `pilot.json`
  replacement.
- `PilotLoop.sync` guards the live cycle's cancellation source. The loop publishes it before reading
  the settings, so an unpair either cancels that cycle or is seen by its read.

## Invariants

- A stop on request raises one requested exit (for Pilot waiters) and never shows a crash banner.
- `PilotApi` probes and reports never throw except on the caller's own cancellation; a failed probe
  returns null.
- A wake that leaves the host paired never interrupts the agent mid-turn; an unpair does.
- The user's typing in the terminal holds new runs; a run already in progress keeps going.
- `pilot.json` keeps its wire shape, is DPAPI-protected on Windows, and is created with mode `0600`
  on Unix.

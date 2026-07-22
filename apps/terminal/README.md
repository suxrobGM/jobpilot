# JobPilot Terminal Host

The terminal host is a local .NET process that exposes one Claude Code or Codex PTY to the web app. It owns no
cloud application state; it launches the provider with the authenticated JobPilot API environment and relays raw
terminal traffic.

## Runtime flows

### Interactive terminal

`/sessions/start` validates the request and passes `SessionStartOptions` to `SessionManager`. The manager resolves
the bundled provider assets, builds the `JOBPILOT_*` environment, and starts `IPty`. `TerminalHub` broadcasts PTY
output to WebSocket clients and keeps a bounded replay buffer for reconnects. Browser input and resize messages
flow back through the hub to the same session.

### Pilot

`PilotStore` persists the provider pairing and enabled flag. `PilotCoordinator` owns the background lifecycle,
runs `PilotCycleRunner` while enabled, and owns the inter-cycle sleep so a wake can end it early. The runner
orchestrates one cycle: `CompletionTracker` and `CycleWaiter` cover the sentinel wait, the server-reported
completion fallback, and liveness; `InterventionLadder` climbs check-in, skip, then restart, with backoff. Its
side effects (PTY, timing, API) live behind `IPilotRuntime`. `PilotEventListener` consumes the API SSE feed and
sends coalesced wake pulses when new work can resume a cycle.

### Self-update

`HostUpdateService` selects a newer GitHub release and delegates staging and activation to `ReleaseInstaller`.
`HostHandoff` launches the replacement with `JOBPILOT_AWAIT_PID`; the child waits for the old process to release
the port. The updater owns the host executable and bundled `plugin/` tree. Files elsewhere in the installation
root may be user state and must not be pruned.

## Shared-state ownership

- `SessionManager.stateLock` owns session state, provider identity, PTY generation, and requested-stop generation.
- `PtyProcess.connectionLock` owns the active Pty.Net connection. Every exit carries its generation so delayed
  exits cannot stop a replacement session.
- `TerminalHub.replayLock` orders replay-buffer writes with WebSocket registration and protects the client map.
- `PilotStore.gate` owns the immutable in-memory pairing snapshot and serializes atomic `pilot.json` replacement.
- `PilotWakeSignal.gate` owns the current iteration and inter-cycle-sleep cancellation sources. Its capacity-one
  pulse channel coalesces event bursts; the separate runtime `WaitSignal` channel remains lossless for cycle sentinels.

## Invariants

- Explicit session stops still raise a requested exit for Pilot waiters, but never produce a crash banner.
- Provider replacement disowns the outgoing PTY generation before stopping it.
- A caller cancellation must propagate through Pilot probes, reports, and command submission; transport failures
  alone fail open to the orchestrator ladder.
- SSE re-pairing is heartbeat-bounded: the next frame detects changed credentials and reconnects without backoff.
- `pilot.json` keeps its stable wire shape, is DPAPI-protected on Windows, and is created with mode `0600` on Unix.

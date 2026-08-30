# `board.health`

Payload `{board, consecutiveFailures, recentFailReasons, probeJob}` - the board is failing repeatedly. Run ONE diagnostic probe in careful mode: log in per `../../_shared/auth.md` (this alone often reveals the cause - expired login, changed flow, bot wall). If `probeJob` is present, delegate ONE `job-worker` apply for it with full attention. Then:

- Probe succeeds (login ok / job applied) → journal "Board <board> healthy again - probe applied/logged in cleanly." Done; the server's streak resets via the successful result.
- Probe fails → journal the diagnosis, naming what the probe actually hit ("Board <board> still failing after probe - login page returns a bot wall."). Nothing to ask: the user reads it in the journal and fixes credentials or drops the board from their instructions themselves.

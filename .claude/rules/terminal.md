---
paths:
  - "apps/terminal/**"
  - "tests/**"
---

# Terminal host conventions (`apps/terminal`, `tests/`)

`JobPilot.Terminal` is a .NET 10 minimal API that hosts one provider PTY on the user's machine.
Endpoints: `/ws`, `/sessions/start`, `/sessions/inject`, `/pilot/start`, `/pilot/stop`,
`/update`, `/shutdown`, `/healthz`. `/sessions/start` takes the user's `apiToken` and sets it
in the PTY as `JOBPILOT_API_TOKEN`. The host env var is a local-dev fallback only.

- A C# change needs a rebuild and restart. Invoke the `restart-terminal` skill.
- Run `dotnet test tests/JobPilot.Terminal.Tests` after every change. It asserts exact defaults,
  so config changes break it until updated.
- `build:terminal` (AOT) needs `vswhere.exe` on PATH. Prepend
  `${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer` first.
- Internals: `apps/terminal/README.md`.

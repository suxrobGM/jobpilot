---
paths:
  - "apps/terminal/**"
  - "tests/**"
---

# Terminal host conventions (`apps/terminal`, `tests/`)

`JobPilot.Terminal` is a .NET 10 minimal API that hosts one provider PTY on the user's machine.
Endpoints: `/ws`, `/sessions/start`, `/pilot/pairing`, `/pilot/hold`,
`/update`, `/shutdown`, `/healthz`. `/sessions/start` requires `apiToken`, `apiUrl` and `webUrl` and sets them
in the PTY as `JOBPILOT_API_TOKEN`, `JOBPILOT_API` and `JOBPILOT_WEB`; there is no env fallback.

- A C# change needs a rebuild and restart. Invoke the `restart-terminal` skill.
- Run `dotnet test` after every change. It asserts exact defaults,
  so config changes break it until updated.
- `build:terminal` (AOT) needs `vswhere.exe` on PATH. Prepend
  `${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer` first.
- Internals: `apps/terminal/README.md`.

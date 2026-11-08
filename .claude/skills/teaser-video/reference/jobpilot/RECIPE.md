# JobPilot teaser (v3, 2026-11-08)

"It did 63 things. You did 2." A 52s, 26-bar cut. A HUD counts real Claude Code tool calls
against the user's two clicks: send one chat request, then Apply now on one job. This folder is
an overlay on `../edit` and `../capture`; together they rebuild the shipped film.

| Bars | Section | Footage |
| --- | --- | --- |
| 2 | hook | FormStack + "Applying to jobs is a second job." |
| 1 | reveal | logo |
| 3 | start | composer: type the request, send (You: 1) |
| 2 | handoff | Agent drawer opens, Claude Code takes the chat run |
| 6 | hero | terminal, then split: terminal + agent Chrome on hiring.cafe |
| 2 | pause | Pipeline → job drawer → hover Apply now ("Your call") |
| 4 | submit | click (You: 2), split: applier terminal + real Ashby form |
| 2 | payoff | thread "Applied to WitnessAI" |
| 2 | trust | "Your machine. Your Claude Code. Your rules." + rules card |
| 2 | close | tally 63 / 2, logo, headline, URL |

## Re-edit only (footage unchanged)

The clips and the run's tool-call log (`src/data/actions.json`, made by `tool-calls.mjs`) live in
`.tmp/teaser-v3/edit/` (gitignored, local only). If the clips are gone, re-film.

```bash
S=.tmp/teaser-v3-edit
cp -r .claude/skills/teaser-video/reference/edit "$S" && cp -r .claude/skills/teaser-video/reference/jobpilot/edit/. "$S"
cp -r .tmp/teaser-v3/edit/public/clips "$S/public/" && cp apps/web/public/icon.svg "$S/public/logo.svg"
mkdir -p "$S/src/data" && cp .tmp/teaser-v3/edit/src/data/actions.json "$S/src/data/"
cd "$S" && npm install && npm run synth
npx remotion render src/index.ts Teaser out/teaser.mp4 --codec=h264 --crf=16 --audio-codec=aac --audio-bitrate=192k --concurrency=4
npx remotion still src/index.ts Poster out/teaser-poster.png
```

Deliver (sizes the landing page and README expect: about 10 MB MP4, 7 MB GIF):

```bash
ffmpeg -i out/teaser.mp4 -c:v libx264 -preset slower -crf 28 -tune animation -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k ../../apps/web/public/teaser.mp4
ffmpeg -i out/teaser-poster.png -q:v 3 ../../apps/web/public/teaser-poster.jpg
ffmpeg -i out/teaser.mp4 -vf "fps=8,scale=560:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" ../../docs/images/teaser.gif
```

Then check the caption under the video in
`apps/web/src/components/features/marketing/sections/teaser.tsx`.

Where to change things:

- Order of sections: `src/Teaser.tsx` (`SCENES`, one row per storyboard section).
- Timing: `storyboard.json` (bars) and `src/clock.ts` `FOOTAGE`, the named stretches of clip
  (start second + speed). The HUD counter and the pulses read the same table, so they stay in sync.
- One beat: `src/scenes/` (`Intro`, `Ask`, `Apply`, `Outro`), built from `Layout.tsx`
  (`WebShot`, the `Split` terminal + browser screen, `Tag`).
- Camera: `cams` keyframes in the scenes, in source pixels of the 3200x1800 web clips (CSS px
  x2). Named spots (composer, terminal, Apply now, rules card) and clip sizes live in
  `src/shots.ts`, with the user's two clicks (`SENT`, `CLICKED`).
- Sound effects: `src/cues.ts`.
- Music: the kit's `audio/synth.mjs`, steered by `storyboard.json` (`grooveB` and `hits`, both
  `submit` here). The user rejected a silent drop-out for "Your call"; keep it continuous, with
  only an impact on the Apply-now click.
- Poster: `src/Poster.tsx`, the chat at ask-web 14.4s. It is a 60fps one-frame
  `Composition`: in `<Still>`, `Footage` reads `startFrom` at the wrong fps.

## Re-film

1. **Stack.** Local DB on :5432 (a prod copy; reading is allowed, never the tunnel). Stop any
   other host on :4102. Start the host without the filming session's env, or Claude Code shows
   "Transcript saving is off" and writes no transcript:
   `env $(env | grep -E "^(CLAUDE|CLAUDECODE|ANTHROPIC)" | cut -d= -f1 | sed 's/^/-u /') bun run dev:terminal`.
   Run the web as a production build (`bun run build:web`, then `next start -p 4100`). The dev
   server's "N" badge sits in every frame. Then `bun --cwd=apps/api run dev`.
2. **Consent.** Agree which job gets a real application, and that only the user's name may show.
   Autopilot stays off, so only requests run. Applications land in the local copy only: tell the
   user to mark them applied in prod.
3. **Login.** Copy `../capture` to a scratch dir with `jobpilot/film/*` inside it (the scenes
   import `./cam.js`). Run `node login.js /login` there (the user signs in), then `scout.js` the
   screens. With autopilot off nothing scores rows, so ask for a board whose rows carry full
   descriptions (hiring.cafe). Indeed rows stay unscored.
4. **Takes** (`TEASER_BASE_URL=http://localhost:4100`, `TEASER_HEALTH_URL=http://127.0.0.1:4102/healthz`):
   - ask: `TEASER_REQUEST="..." node live.js ask --path /pilot --ready main --do scene-ask.js`.
     Follow `bash runs.sh <repo> <email>` until `search.discover` is done, then touch `takes/ask/STOP`.
   - apply: rehearse first with `rehearse-apply.js` (no click). Then
     `TEASER_JOB="<company>" node live.js apply --path "/pipeline?feed=<searchId>" --ready "text=Best match first" --do scene-apply.js`.
     Confirm the submit in the applier transcript, not the footage (see below).
   - pickups: `node pickups.js` after the run (thread, Applied tab).
5. **Clock.** Put each take's `t0 epoch_ms` + the first-frame offsets from `events.log` into
   `CLIP_ZERO` in `src/clock.ts`. Run
   `node tool-calls.mjs ~/.claude/projects/<slug> src/data/actions.json ask=<from>..<to> apply=<from>..<to> --skip <your session id>`.
6. Normalize the clips (SKILL.md section 3), contact-sheet them, re-time `SEGMENTS`, render stills.

## Never on screen

- Analytics "Top failure reasons": it quotes a security answer and the email.
- Searches & rules page: search reasons (visa status) and Standing answers (criminal record,
  citizenship). Show the rules card on the Pilot side panel instead.
- hiring.cafe's login modal (the agent types the email into it). Form fields once filled.
- Inbox (other people's names). Reviewed safe: terminal UUIDs and paths, collapsed API output.

## Known traps

- The agent's Playwright Chrome fills forms in a background tab. Window capture shows only the
  front tab, so the filled form and the success page never appear. The proof is the terminal's
  `job-applier` lines and the thread's "Applied" turn.
- Pilot chat replies are markdown, but the thread prints them as plain text. `**` shows on
  screen, so frame around replies or fix the thread first.
- The Pilot side panel carries a Stealth Code banner; keep it out of tight shots.

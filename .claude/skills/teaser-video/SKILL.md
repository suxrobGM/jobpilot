---
name: teaser-video
description: Film, edit, and deliver a launch-quality teaser of any web app - real footage captured at 2x with Playwright + CDP (and Windows Graphics Capture for external windows such as an agent's browser), edited in Remotion with a virtual camera, motion graphics, kinetic type, and a synthesized license-free soundtrack. Use for "make a teaser", "record a demo video", "product launch video", "screen recording for the README".
user-invocable: true
compatibility: Node 24+, ffmpeg 8+ on PATH (gfxcapture + h264_nvenc on Windows; swap `ENCODER` in cam.js elsewhere), and a Chrome channel for Playwright. npm packages come from reference/capture and reference/edit package.json, installed in a scratch dir, never the project.
metadata:
  version: "1.2"
  updated: "2026-11-08"
  portable: "true"
---

# Teaser video

A ~40s teaser that looks like a product film, not a screen recording. The
difference is direction: one story, real proof, a camera that moves with
intent, graphics that explain cause and effect, and sound cut to a beat.

Pipeline: **capture** real footage (Playwright drives, CDP films at 2x) →
**edit** in Remotion (React components rendered frame by frame) → **review**
every frame for PII → deliver MP4 + poster + README GIF.

Work in a scratch directory, never in the project:

```bash
cp -r <skill>/reference/capture "$SCRATCH/film" && (cd "$SCRATCH/film" && npm install)
cp -r <skill>/reference/edit "$SCRATCH/edit" && (cd "$SCRATCH/edit" && npm install && npm run synth && npm run still)
export TEASER_BASE_URL="https://the-app.example.com"
export TEASER_LOCAL_STORAGE='{"some:ui-pref":"value"}'   # optional UI state to pin
```

`npm run still` renders the starter `Teaser.tsx` (no clips needed), proving the
toolchain works before any filming. Keep every `remotion` / `@remotion/*`
package on the same version; mismatches fail at render time.

**Updating JobPilot's own teaser?** Start from `reference/jobpilot/RECIPE.md`.
It overlays the shipped v3 timeline, clock map, music and scenes on this kit,
so a re-edit is copy + render and a re-film reuses every script.

## The two hard rules

**1. Real side effects need explicit, itemized consent.** Filming a real app
clicks real buttons: applications get submitted, emails sent, accounts
touched. Agree the scope with the user before rolling. Answer the app's own
prompts only within that scope; anything that creates accounts, picks a
sign-in method, or answers personal questions (tax, demographics) stays parked
for the user. Before stopping a long-running process, let the in-flight unit of
work finish instead of cutting it mid-way. Report every outcome, including
failures and anything the product did on its own (password resets, etc.).

**2. Every frame is public.** Agree what may show (e.g. name + email) and treat
everything else as private: phone numbers, other people's names (chat
bubbles), security answers, tokens. Hide by framing, by masking in the edit,
or by not filming that part of the page. Dashboards can quote secrets
verbatim (a "failure reasons" list once showed a security-question answer) -
read every captured screen, not just the part you meant to film.

## 1. Scout and storyboard

Screenshot every candidate screen with the saved session. Write the
storyboard on the music grid (120 BPM → 1 bar = 2s = 120 frames at 60fps),
then put the section lengths in `reference/edit/storyboard.json`. `theme.ts`
(`SECTIONS`) and `audio/synth.mjs` both read it, so retiming a section moves
the cuts and the music together:

| Beat | Length | Job |
| --- | --- | --- |
| Hook | 2 bars | The pain, as a pure motion graphic (no UI yet) |
| Reveal | 1 bar | Logo on the impact |
| Start | 4 bars | The one action the user takes |
| Hero | 5 bars | The product doing the thing, split-screen if two surfaces |
| Payoff | 5 bars | Results landing in the app (counters, lists, charts) |
| Trust | 3 bars | Control and where it runs |
| Close | 2 bars | Logo, URL, CTA |

The hero is the reason the video exists. Show cause and effect: the agent acts
in one pane, the result appears in another, and a graphic (a chip flying from
the success state into the counter) connects them.

## 2. Capture

- `login.js`: headed login once, saves `storageState.json`. In Git Bash set
  `MSYS_NO_PATHCONV=1` or path args like `/login` become Windows paths.
- `cam.js`: choreographed takes, and the shared kit `login.js`/`live.js` build
  on (`BASE`, `AUTH_PATHS`, `ENCODER`: swap to libx264 there without NVIDIA). `open()`, `roll()` (CDP screencast piped into
  ffmpeg with wall-clock timestamps), `click()`/`glide()` with an injected
  cursor, `scrollTo()`/`scrollToEl()` on the app's inner scroll container.
  Pass `ready` (a selector for the content the shot needs) to `open()`/`go()`
  so takes start on loaded UI instead of after a guessed sleep.
- `live.js`: long unattended takes of a real run. Films the page, auto-detects
  the agent's own Chrome window and records it with `gfxcapture` (works while
  covered by other windows, not while minimized), and logs status changes
  with timestamps so you can find the moments afterwards. Stop it by touching
  `takes/<name>/STOP`. The window capture shows only Chrome's front tab, and
  Playwright MCP can fill a form in a background tab, so plan the proof of the
  submit around the agent's terminal and the app, not the form itself.
  `--do scene.js` runs a scene module (`export default async ({ page, log })`)
  after rolling, for the user's on-camera clicks inside the same take.
- `scout.js`: screenshots `name=/path` pairs for the storyboard. Set
  `TEASER_READY` when the first `<main>` is hidden.
- `tool-calls.mjs`: every Claude Code tool call with its timestamp, from the
  session transcripts (subagents included) inside named wall-clock windows.
  Feed it to an on-screen counter so the number is real, not invented.
- If the agent is Claude Code launched from your own Claude Code session,
  unset the inherited `CLAUDE*` env first, or it saves no transcript and
  shows a warning on screen.

Film at **1600x900 CSS with `--force-device-scale-factor=2`** (3200x1800
frames). Without the flag, headless screencast silently returns 1x frames even
with `deviceScaleFactor: 2`. 2x is what lets the edit push in on a number or a
terminal line and stay sharp. Always check `ffprobe` width after the first take.

## 3. Prepare clips

Captures are variable-frame-rate (frames only arrive on repaint) and window
captures start at a non-zero timestamp with long gaps while nothing changes.
Normalize every clip before Remotion sees it:

```bash
ffmpeg -i take.mkv -vf "setpts=PTS-STARTPTS,crop=W:H:X:Y,fps=60,format=yuv420p" -c:v libx264 -crf 14 -g 30 -an clips/x.mp4
```

`crop` needs even dimensions. Map the clip with a 1-second contact sheet
(`fps=1,scale=200:-1,tile=15x6`) and read times off it. Don't trust `-ss`
seeks on the raw VFR capture.

## 4. Edit (Remotion)

Components in `reference/edit/src/components` (palette, fonts, `BRAND`, `alpha()`
and `clamp` in `src/theme.ts`):

- `Shot.tsx`: `Footage` = footage seen through a virtual camera. Keyframes
  `{f, x, y, z}` in source pixels, eased, zoom interpolated in log space,
  clamped to the footage edge. Overlays passed as children live in source
  pixel space and track the camera. `AppWindow` frames it as a browser.
  There's no ffmpeg `zoompan` anywhere (it quantizes and shakes).
- `Kinetic.tsx` / `Caption.tsx`: word-by-word rise + unblur, `*accent*`
  spans in the brand color, a scrim so text reads over any frame.
- `Overlays.tsx`: `Pulse` (look here), `Spotlight` (dim the rest),
  `FlyingChip` (the result travelling between scenes), `CountUp`, `Callout`.
- `Background.tsx`, `Logo.tsx`, `FormStack.tsx`: stage, logo sting, a sample
  hook graphic.
- `Hud.tsx`: two live counters (agent vs user) that pop when they change.
  Drive them from `tool-calls.mjs` through a frame → wall-clock map
  (`reference/jobpilot/edit/src/clock.ts` is a worked one).
- `Pulses.tsx`: a spark per real tool call, from the terminal pane into the
  browser pane, so split screens read as cause and effect.
- `Sound.tsx`: music bed + SFX cues by frame.

Rules that made the difference:

- Copy the app's palette and fonts into `theme.ts`. Use its easing curve for
  every move.
- Speed-ramp real footage per segment (`Sequence` + `startFrom` + `rate`):
  compress the waiting, play the payoff near real time.
- One camera move per shot, motivated by what changes on screen.
- Prefer honest overlays: point at the real number and pop a "+1" instead of
  faking a count-up over the UI.
- Masks for PII must be on from the first frame the data renders. Find that
  frame (`crop` + `signalstats`, or a frame stack), don't guess.
- Render stills (`npx remotion still ... --frame=N`) at every beat and read
  them before any full render.

## 5. Sound

`audio/synth.mjs` renders the music bed and SFX from oscillators and noise, so
everything is license-free by construction. Structure follows the storyboard
bars: ticking intro, riser into an impact on the reveal, groove under the
product, adds an arp for the payoff, breakdown for trust, final impact. Mix
with separate drum/tonal stems, kick sidechain, and a limiter, then check
`ebur128` loudness (aim around -14 LUFS) and the waveform. You can't listen
to it, so say so and invite the user to swap in a track (cuts sit on the bar
grid, so any 120 BPM track drops in).

The video must also work muted: captions carry the story.

## 6. Review and deliver

- Render: `npm run render` (h264 + AAC into `out/teaser.mp4`).
- Full-resolution frames at 2fps for the PII read, plus a contact sheet.
- Poster: a frame that explains the product without motion (usually the hero
  split).
- README GIF: GitHub won't inline a committed MP4. Encode from the clean MP4,
  aim for 3-4 MB. Bayer dither + `diff_mode=rectangle` keeps static UI identical
  between frames; error-diffusion dither on moving footage bloats the file:
  `ffmpeg -i out/teaser.mp4 -vf "fps=10,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" teaser.gif`
- Update any page copy that states the duration or "no sound".

Report the outputs, what really happened during filming (applications sent,
failures, items left for the user), and what still needs a human (listening to
the mix).

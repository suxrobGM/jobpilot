# Natural writing skill

Tier 3 - Intelligence & Efficiency · Status: **todo**

## What

A skill that writes job-application prose in the user's voice, replacing the pattern-scrubbing pass
the apply flows run today.

## Why

The letters read as AI to a human reader. `cover-letter/SKILL.md` already carries 16 anti-AI rules of
its own, then calls `humanizer` for 38 more patterns. Both say what to avoid; neither says what to
sound like. So the output dodges the known tells and keeps the generated sentence skeleton, which is
what a reader actually recognizes. Adding more patterns does not fix that, because the mechanism is
generate-then-patch: the second pass edits the first pass's clauses instead of re-saying the point.

It is also the most-read output the app produces. A recruiter sees the letter before anything else.

## Call sites to move

`cover-letter`, `networking`, and the pilot's `interview.reply`, `networking.followup`,
`networking.warmIntro` and `promo.compose` branches (`plugin/skills/pilot/kinds/`). All six invoke
`humanizer` in embedded mode today.

## Decisions still open

- **What it targets as natural.** Three candidates: a voice profile derived from writing samples the
  user pastes once; a profile harvested from the diff whenever the user edits a saved letter in the
  web app (`CoverLetter` would need `editedContent`/`editedAt`); or method alone with no stored
  profile. The first two need somewhere to keep the profile - `User` has no field for it.
- **Whether it re-expresses rather than edits.** Extracting the facts from the draft and writing them
  again from scratch is what breaks the sentence skeleton; editing the draft cannot.
- **What happens to `humanizer`.** It stays useful for `review-resume`, `upwork-profile` and
  `upwork-proposal`, which are not the hot path and not first-person. Vendored from
  [blader/humanizer](https://github.com/blader/humanizer); sync procedure in `.claude/rules/plugin.md`.

## Done when

A letter drafted for a real posting reads as the user's own writing to the user, and the apply flow
no longer loads a 6000-word pattern list per job.

## Notes

- 2026-08-30: filed while syncing the vendored humanizer from 2.9.1 to 2.11.2. The sync is unrelated
  to this fix and does not address it - 2.11.2 is still a prohibition list, just a tidier one.

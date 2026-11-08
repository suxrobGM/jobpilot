import type { Cue } from "./components/Sound";
import { CLICKED, SENT } from "./shots";
import { SECTIONS } from "./theme";

const { start, handoff, hero, submit, payoff, trust } = SECTIONS;

/** Sound effects over the music bed; the two clicks are the user's actions. */
export const CUES: Cue[] = [
  { at: start.from + 40, sfx: "typing", volume: 0.35, dur: 200 },
  { at: SENT, sfx: "click", volume: 0.6 },
  { at: handoff.from + 60, sfx: "whoosh", volume: 0.35 },
  { at: hero.from + 240, sfx: "whoosh", volume: 0.35 },
  { at: CLICKED, sfx: "click", volume: 0.8 },
  { at: submit.from + 30, sfx: "whoosh", volume: 0.35 },
  { at: payoff.from + 40, sfx: "chime", volume: 0.4 },
  { at: trust.from, sfx: "whooshDown", volume: 0.3 },
];

import actions from "./data/actions.json";
import { FPS, SECTIONS } from "./theme";

// Wall-clock epoch (ms) of second 0 in each normalized clip, from the takes' events.log.
const ASK_T0 = 1794107932857;
const APPLY_T0 = 1794109113314;
export const CLIP_ZERO = {
  askWeb: ASK_T0 + 2730,
  askAgent: ASK_T0 + 61680,
  applyWeb: APPLY_T0 + 2710,
  applyAgent: APPLY_T0 + 5370,
} as const;
type Clip = keyof typeof CLIP_ZERO;

/** A stretch of footage: absolute frames [from, to) play clip seconds from `src` at `rate`x. */
export interface Segment {
  from: number;
  to: number;
  clip: Clip;
  src: number;
  rate: number;
}

const { start, handoff, hero, pause, submit } = SECTIONS;
const BAR = 120;

/** What the terminal shows at each point of the film. The Pilot counter reads it. */
export const FOOTAGE = {
  typing: { from: start.from, to: handoff.from, clip: "askWeb", src: 3.8, rate: 1.5 },
  drawerOpens: { from: handoff.from, to: handoff.from + BAR, clip: "askWeb", src: 13.2, rate: 1.2 },
  chatRun: { from: handoff.from + BAR, to: hero.from, clip: "askWeb", src: 15.6, rate: 14.7 },
  searchStarts: { from: hero.from, to: hero.from + 2 * BAR, clip: "askWeb", src: 45, rate: 11.85 },
  searchSplit: {
    from: hero.from + 2 * BAR,
    to: pause.from,
    clip: "askWeb",
    src: 92.4,
    rate: 4.875,
  },
  pickJob: { from: pause.from, to: submit.from, clip: "applyWeb", src: 1.9, rate: 1.542 },
  pressApply: { from: submit.from, to: submit.from + 30, clip: "applyWeb", src: 8.07, rate: 1 },
  applySplit: {
    from: submit.from + 30,
    to: submit.from + submit.frames,
    clip: "applyWeb",
    src: 14,
    rate: 11.07,
  },
} satisfies Record<string, Segment>;

const SEGMENTS: Segment[] = Object.values(FOOTAGE);

/** Frames a segment lasts, for Sequence lengths and camera keyframes. */
export function lengthOf(segment: Segment): number {
  return segment.to - segment.from;
}

function wallAt(frame: number): number | null {
  const segment = SEGMENTS.findLast((s) => frame >= s.from);
  if (!segment) {
    return null;
  }
  const shown = Math.min(frame, segment.to - 1);
  const clipSecond = segment.src + ((shown - segment.from) / FPS) * segment.rate;
  return CLIP_ZERO[segment.clip] + clipSecond * 1000;
}

const toolCalls = [...actions.ask, ...actions.apply].map((call) => ({
  at: Date.parse(call.at),
  browser: call.name.startsWith("browser_"),
}));

export const PILOT_TOTAL = toolCalls.length;

/** Real Claude Code tool calls made up to the wall time on screen. */
export function pilotCount(frame: number): number {
  const wall = wallAt(frame);
  if (wall === null) {
    return 0;
  }
  return toolCalls.filter((call) => call.at <= wall).length;
}

/** Absolute frames where a browser tool call lands inside the segment. */
export function browserCallFrames(segment: Segment): number[] {
  const hits: number[] = [];
  for (let f = segment.from; f < segment.to; f++) {
    const before = wallAt(f - 1);
    const now = wallAt(f);
    if (before === null || now === null) {
      continue;
    }
    for (const call of toolCalls) {
      if (call.browser && call.at > before && call.at <= now) {
        hits.push(f);
      }
    }
  }
  return hits;
}

import { FOOTAGE } from "./clock";
import type { Cam } from "./components/Shot";
import { SECTIONS } from "./theme";

/** Normalized clips in public/clips, with their frame size in px. */
export const CLIPS = {
  askWeb: { src: "clips/ask-web.mp4", sw: 3200, sh: 1800 },
  applyWeb: { src: "clips/apply-web.mp4", sw: 3200, sh: 1800 },
  pickups: { src: "clips/pickups.mp4", sw: 3200, sh: 1800 },
  askAgent: { src: "clips/ask-agent.mp4", sw: 1876, sh: 2046 },
  applyAgent: { src: "clips/apply-agent.mp4", sw: 1876, sh: 2046 },
} as const;
export type ClipName = keyof typeof CLIPS;

// Spots in the 3200x1800 web clips (CSS px x2) that the camera frames.
export const SPOT = {
  composer: { x: 1724, y: 1560 },
  sentMessage: { x: 1724, y: 1330 },
  terminal: { x: 2722, y: 760 },
  applyNow: { x: 2656, y: 334 },
  appliedTurn: { x: 1290, y: 1146 },
  rulesCard: { x: 2900, y: 850 },
} as const;

/** The Agent drawer's terminal column (x 2244-3200) filling a pane. */
export const TERMINAL_CAM: Cam[] = [{ f: 0, ...SPOT.terminal, z: 3.35 }];

/** The agent's Chrome window, tabs and URL bar included. */
export const BROWSER_CAM = { f: 0, x: 938, y: 900, z: 1.12 };

/** Split screen used by hero and submit: terminal left, browser right. */
export const PANE = { top: 168, h: 790, leftX: 80, leftW: 860, rightX: 990, rightW: 850 };

// The user's two actions: Enter in the composer (ask-web 10.22s), and the Apply now click.
export const SENT =
  SECTIONS.start.from + Math.round(((10.22 - FOOTAGE.typing.src) / FOOTAGE.typing.rate) * 60);
export const CLICKED = SECTIONS.submit.from + 6;

export function youCount(frame: number): number {
  if (frame >= CLICKED) {
    return 2;
  }
  if (frame >= SENT) {
    return 1;
  }
  return 0;
}

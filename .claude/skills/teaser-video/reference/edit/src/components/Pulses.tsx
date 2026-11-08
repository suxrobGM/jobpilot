import type { ReactElement } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { alpha, c, clamp, ease } from "../theme";

interface Point {
  x: number;
  y: number;
}

interface PulsesProps {
  /** Absolute frames at which a browser tool call fires. */
  frames: number[];
  /** Absolute frame of this Sequence's local frame 0. */
  offset: number;
  from: Point;
  to: Point;
}

const TRAVEL = 18;

/** A spark per real browser tool call, travelling from the terminal pane into the browser pane. */
export function Pulses(props: PulsesProps): ReactElement {
  const { frames, offset, from, to } = props;
  const f = useCurrentFrame() + offset;
  const live = frames.filter((at) => f >= at && f < at + TRAVEL + 10);
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - 120;
  const path = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
  const glow = live.length > 0 ? 1 : 0;
  return (
    <svg
      width={1920}
      height={1080}
      style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
    >
      <title>Tool call pulses</title>
      <path d={path} stroke={alpha(c.text, 0.06 + 0.1 * glow)} strokeWidth={2} fill="none" />
      {live.map((at) => {
        const t = interpolate(f - at, [0, TRAVEL], [0, 1], { ...clamp, easing: ease });
        const fade = interpolate(f - at, [TRAVEL, TRAVEL + 10], [1, 0], clamp);
        const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t ** 2 * to.x;
        const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t ** 2 * to.y;
        return (
          <g key={at} opacity={fade}>
            <circle cx={x} cy={y} r={16} fill={alpha(c.text, 0.12)} />
            <circle cx={x} cy={y} r={6} fill={c.text} />
          </g>
        );
      })}
    </svg>
  );
}

import type { ReactElement } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, c, clamp, easeOut, fonts } from "../theme";

interface CounterProps {
  label: string;
  value: number;
  /** Frame the value last changed, for the pop. */
  changedAt: number;
  color: string;
  glow: boolean;
}

function Counter(props: CounterProps): ReactElement {
  const { label, value, changedAt, color, glow } = props;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f - changedAt, fps, config: { damping: 9, stiffness: 260 } });
  const bump = 1 + 0.18 * (1 - pop);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 15,
          letterSpacing: "0.16em",
          color: c.text3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: fonts.display,
          fontWeight: 800,
          fontSize: 54,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          color,
          transform: `scale(${bump})`,
          transformOrigin: "100% 60%",
          textShadow: glow ? `0 0 28px ${alpha(color, 0.55)}` : undefined,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

interface HudProps {
  pilot: (frame: number) => number;
  you: (frame: number) => number;
  /** Absolute frames the HUD is on screen. */
  from: number;
  to: number;
}

/** Last frame at or before `frame` where `count` changed value. */
function lastChange(count: (frame: number) => number, frame: number, floor: number): number {
  const now = count(frame);
  let g = frame;
  while (g > floor && count(g - 1) === now) {
    g--;
  }
  return g;
}

/** The film's spine: real Claude Code tool calls against the user's own clicks. */
export function Hud(props: HudProps): ReactElement | null {
  const { pilot, you, from, to } = props;
  const f = useCurrentFrame();
  if (f < from || f >= to) {
    return null;
  }
  const show = interpolate(f, [from, from + 18, to - 14, to], [0, 1, 1, 0], {
    ...clamp,
    easing: easeOut,
  });
  const youValue = you(f);
  return (
    <div
      style={{
        position: "absolute",
        top: 34,
        right: 54,
        display: "flex",
        gap: 40,
        padding: "14px 26px 16px",
        borderRadius: 8,
        background: alpha(c.panel, 0.82),
        border: `1px solid ${c.border}`,
        backdropFilter: "blur(10px)",
        opacity: show,
        transform: `translateY(${(1 - show) * -16}px)`,
      }}
    >
      <Counter
        label="PILOT"
        value={pilot(f)}
        changedAt={lastChange(pilot, f, from)}
        color={c.text}
        glow={false}
      />
      <div style={{ width: 1, background: c.border }} />
      <Counter
        label="YOU"
        value={youValue}
        changedAt={lastChange(you, f, from)}
        color={youValue > 0 ? c.flame : c.text2}
        glow={youValue > 0}
      />
    </div>
  );
}

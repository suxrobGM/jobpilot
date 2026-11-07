import type { ReactElement } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, c, clamp, ease, easeOut, fonts } from "../theme";

interface PulseProps {
  x: number;
  y: number;
  at: number;
  color?: string;
  size?: number;
}

/** Expanding ring that says "look here". Coordinates in whatever space it's placed in. */
export function Pulse(props: PulseProps): ReactElement {
  const { x, y, at, color = c.flame, size = 120 } = props;
  const f = useCurrentFrame() - at;
  const rings = [0, 10].map((d) => {
    const p = interpolate(f - d, [0, 40], [0, 1], clamp);
    return (
      <div
        key={d}
        style={{
          position: "absolute",
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          border: `3px solid ${color}`,
          opacity: p > 0 && p < 1 ? (1 - p) * 0.9 : 0,
          transform: `scale(${0.3 + p * 1.2})`,
        }}
      />
    );
  });
  return <>{rings}</>;
}

interface SpotlightProps {
  /** Rect in the same space as the parent. */
  x: number;
  y: number;
  w: number;
  h: number;
  at: number;
  until?: number;
  radius?: number;
  dim?: number;
}

/** Dims everything except one rect, with a flame outline. */
export function Spotlight(props: SpotlightProps): ReactElement {
  const { x, y, w, h, at, until = 1e9, radius = 14, dim = 0.55 } = props;
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 18, until, until + 14], [0, 1, 1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: radius,
        boxShadow: `0 0 0 9999px rgba(5,5,4,${dim * p}), 0 0 0 ${2 * p}px ${c.flame}, 0 0 ${50 * p}px ${alpha(c.flame, 0.45 * p)}`,
        pointerEvents: "none",
      }}
    />
  );
}

interface ChipProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  at: number;
  dur?: number;
  label?: string;
}

/** The "Applied" token: pops at the submit button, arcs to its destination, lands. */
export function FlyingChip(props: ChipProps): ReactElement | null {
  const { from, to, at, dur = 42, label = "Applied" } = props;
  const f = useCurrentFrame() - at;
  const { fps } = useVideoConfig();
  if (f < 0 || f > dur + 16) {
    return null;
  }
  const pop = spring({ frame: f, fps, config: { damping: 11, stiffness: 220 } });
  const t = interpolate(f, [10, dur], [0, 1], { ...clamp, easing: ease });
  // Quadratic arc, lifting above the straight line.
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - 260;
  const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t ** 2 * to.x;
  const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t ** 2 * to.y;
  const land = interpolate(f, [dur, dur + 16], [1, 0], clamp);
  const scale = pop * (1 - 0.35 * t) * (0.6 + 0.4 * land);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity: land,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 26px 14px 18px",
        borderRadius: 999,
        background: alpha(c.success, 0.14),
        border: `2px solid ${c.success}`,
        boxShadow: `0 0 50px ${alpha(c.success, 0.45)}, 0 20px 50px rgba(0,0,0,0.5)`,
        backdropFilter: "blur(8px)",
        fontFamily: fonts.display,
        fontWeight: 700,
        fontSize: 34,
        color: c.text,
        whiteSpace: "nowrap",
      }}
    >
      <svg width="34" height="34" viewBox="0 0 24 24">
        <title>Applied</title>
        <circle cx="12" cy="12" r="11" fill={c.success} />
        <path
          d="M7 12.5 L10.5 16 L17 9"
          stroke={c.base}
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </div>
  );
}

interface CountProps {
  from: number;
  to: number;
  at: number;
  dur?: number;
  suffix?: string;
  size?: number;
  color?: string;
}

/** Count-up with a little kick on each change. */
export function CountUp(props: CountProps): ReactElement {
  const { from, to, at, dur = 30, suffix = "", size = 160, color = c.text } = props;
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + dur], [0, 1], { ...clamp, easing: easeOut });
  const v = Math.round(from + (to - from) * p);
  const kick = interpolate(f, [at + dur, at + dur + 6, at + dur + 18], [1, 1.08, 1], clamp);
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: fonts.display,
        fontWeight: 800,
        fontSize: size,
        letterSpacing: "-0.04em",
        color,
        transform: `scale(${kick})`,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {v.toLocaleString("en-US")}
      {suffix}
    </span>
  );
}

interface LabelProps {
  text: string;
  at: number;
  x: number;
  y: number;
  until?: number;
  align?: "left" | "right";
}

/** Small mono callout with a leader dot, for pointing at UI. */
export function Callout(props: LabelProps): ReactElement {
  const { text, at, x, y, until = 1e9, align = "left" } = props;
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 16, until, until + 12], [0, 1, 1, 0], {
    ...clamp,
    easing: easeOut,
  });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(${align === "right" ? "-100%" : "0"}, -50%) translateX(${(1 - p) * (align === "right" ? 20 : -20)}px)`,
        opacity: p,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexDirection: align === "right" ? "row-reverse" : "row",
        fontFamily: fonts.mono,
        fontSize: 24,
        color: c.text,
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          background: c.flame,
          boxShadow: `0 0 16px ${c.flame}`,
        }}
      />
      <div
        style={{
          padding: "10px 16px",
          borderRadius: 10,
          background: alpha(c.card, 0.92),
          border: `1px solid ${c.borderHi}`,
        }}
      >
        {text}
      </div>
    </div>
  );
}

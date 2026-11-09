import type { CSSProperties, ReactElement } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { alpha, c, clamp, easeOut, fonts } from "../theme";

export interface Word {
  text: string;
  accent?: boolean;
}

interface KineticProps {
  lines: Word[][];
  /** Frame the first word starts. */
  at?: number;
  stagger?: number;
  dur?: number;
  /** Frame the whole block starts leaving; omit to stay. */
  outAt?: number;
  size?: number;
  align?: CSSProperties["textAlign"];
  style?: CSSProperties;
  weight?: number;
}

/** Word-by-word reveal: rise + unblur, accent words glow in flame. */
export function Kinetic(props: KineticProps): ReactElement {
  const {
    lines,
    at = 0,
    stagger = 4,
    dur = 22,
    outAt,
    size = 96,
    align = "center",
    style,
    weight = 800,
  } = props;
  const f = useCurrentFrame();
  let i = 0;
  const out =
    outAt === undefined
      ? 0
      : interpolate(f, [outAt, outAt + 14], [0, 1], { ...clamp, easing: easeOut });
  return (
    <div
      style={{
        fontFamily: fonts.display,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.04,
        letterSpacing: "-0.035em",
        color: c.text,
        textAlign: align,
        opacity: 1 - out,
        transform: `translateY(${-out * 30}px)`,
        filter: out > 0 ? `blur(${out * 10}px)` : undefined,
        ...style,
      }}
    >
      {lines.map((line) => (
        <div
          key={line.map((w) => w.text).join(" ")}
          style={{ display: "block", whiteSpace: "nowrap" }}
        >
          {line.map((w) => {
            // Reveal order across the whole block doubles as a stable key.
            const order = i++;
            const start = at + order * stagger;
            const p = interpolate(f, [start, start + dur], [0, 1], { ...clamp, easing: easeOut });
            return (
              <span
                key={order}
                style={{ display: "inline-block", overflow: "visible", marginRight: "0.24em" }}
              >
                <span
                  style={{
                    display: "inline-block",
                    opacity: p,
                    transform: `translateY(${(1 - p) * 0.45}em) scale(${0.96 + p * 0.04})`,
                    // Settled words drop their filter so it is not rasterized every frame.
                    filter: p < 1 ? `blur(${(1 - p) * 12}px)` : undefined,
                    color: w.accent ? c.flame : undefined,
                    textShadow: w.accent ? `0 0 ${40 * p}px ${alpha(c.flame, 0.45)}` : undefined,
                  }}
                >
                  {w.text}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Parse "Applying to *jobs*" -> words, *x* marks accent. */
export function words(s: string): Word[] {
  let inAccent = false;
  return s.split(" ").map((t) => {
    const opens = t.startsWith("*");
    const closes = t.endsWith("*") && t.length > 1;
    if (opens) {
      inAccent = true;
    }
    const word = { text: t.replace(/^\*|\*$/g, ""), accent: inAccent };
    if (closes) {
      inAccent = false;
    }
    return word;
  });
}

interface EyebrowProps {
  text: string;
  at?: number;
  outAt?: number;
  color?: string;
}

export function Eyebrow(props: EyebrowProps): ReactElement {
  const { text, at = 0, outAt = 1e9, color = c.flame } = props;
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 24], [0, 1], { ...clamp, easing: easeOut });
  const out = interpolate(f, [outAt, outAt + 12], [1, 0], clamp);
  const shown = Math.round(text.length * p);
  return (
    <div
      style={{
        fontFamily: fonts.mono,
        fontSize: 22,
        letterSpacing: "0.22em",
        color,
        opacity: Math.min(1, p * 2) * out,
        textTransform: "uppercase",
      }}
    >
      {text.slice(0, shown)}
      <span style={{ opacity: p < 1 ? 1 : 0 }}>▍</span>
    </div>
  );
}

import type { ReactElement } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { alpha, c, clamp, fonts } from "../theme";

const COMPANIES = [
  "Northwind",
  "Lumen AI",
  "Brightpath",
  "Corvid Labs",
  "Helio Systems",
  "Quanta Works",
  "Meridian",
  "Tessellate",
  "Kestrel AI",
  "Fathom",
  "Aurora Grid",
  "Halcyon",
];
const ROLES = [
  "ML Engineer",
  "Software Engineer",
  "Data Scientist",
  "Backend Engineer",
  "AI Engineer",
  "Platform Engineer",
];
const FIELDS = [
  "Full name",
  "Email",
  "Phone",
  "Resume / CV",
  "LinkedIn profile",
  "Why do you want to work here?",
  "Are you authorized to work in the US?",
  "Expected salary",
  "Years of experience",
];

interface FormCardProps {
  n: number;
  fill: number;
}

/** A simplified application form: the same questions, again and again. */
function FormCard(props: FormCardProps): ReactElement {
  const { n, fill } = props;
  const fields = FIELDS.slice(0, 6 + (n % 3));
  return (
    <div
      style={{
        width: 520,
        padding: "30px 34px",
        borderRadius: 22,
        background: `linear-gradient(180deg, ${c.elevated}, ${c.card})`,
        border: `1px solid ${c.border}`,
        boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
        fontFamily: fonts.display,
        color: c.text,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 26, fontWeight: 700 }}>{ROLES[n % ROLES.length]}</div>
        <div style={{ fontFamily: fonts.mono, fontSize: 16, color: c.text3 }}>
          #{String(n + 1).padStart(3, "0")}
        </div>
      </div>
      <div style={{ fontSize: 18, color: c.text2, marginTop: 4, marginBottom: 18 }}>
        {COMPANIES[n % COMPANIES.length]} · Apply
      </div>
      {fields.map((label, i) => {
        const filled = Math.max(0, Math.min(1, fill * fields.length - i));
        return (
          <div key={label} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, color: c.text2, marginBottom: 5 }}>{label}</div>
            <div
              style={{
                height: 34,
                borderRadius: 8,
                border: `1px solid ${c.border}`,
                background: c.base,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 10,
                  top: 12,
                  height: 10,
                  width: `${filled * (40 + ((i * 37 + n * 13) % 50))}%`,
                  borderRadius: 5,
                  background: c.text3,
                }}
              />
            </div>
          </div>
        );
      })}
      <div
        style={{
          marginTop: 18,
          height: 44,
          borderRadius: 10,
          background: c.hover,
          display: "grid",
          placeItems: "center",
          fontSize: 17,
          fontWeight: 600,
          color: c.text2,
        }}
      >
        Submit application
      </div>
    </div>
  );
}

interface FormStackProps {
  /** Frames over which the pile accelerates. */
  dur: number;
}

/**
 * The grind: forms fly up out of the dark in a tilted 3D plane, faster and
 * faster. Pure motion graphic, no real data.
 */
export function FormStack(props: FormStackProps): ReactElement {
  const { dur } = props;
  const f = useCurrentFrame();
  // Accelerating progress: position along the conveyor in "cards".
  const t = f / dur;
  const pos = 1.2 * t + 9 * t ** 3;
  const cards = [];
  for (let n = Math.max(0, Math.floor(pos) - 4); n < Math.floor(pos) + 3; n++) {
    const d = n - pos; // <0 = already passed upward
    const col = n % 3;
    const x = (col - 1) * 560 + Math.sin(n * 1.7) * 40;
    const y = -d * 420 + 120;
    const z = -Math.abs(d) * 160 - col * 30;
    const op = interpolate(d, [-3, -1.6, 0, 1.6], [0, 1, 1, 0], clamp);
    const fill = interpolate(d, [-0.6, 1], [1, 0], clamp);
    cards.push(
      <div
        key={n}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px)`,
          opacity: op,
        }}
      >
        <FormCard n={n} fill={fill} />
      </div>,
    );
  }
  return (
    <AbsoluteFill style={{ perspective: 1600, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transformStyle: "preserve-3d",
          transform: "rotateX(28deg) rotateZ(-8deg) scale(1.05)",
        }}
      >
        {cards}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 45% at 50% 50%, ${alpha(c.base, 0.86)}, ${alpha(c.base, 0.35)} 55%, ${alpha(c.base, 0.05)})`,
        }}
      />
    </AbsoluteFill>
  );
}

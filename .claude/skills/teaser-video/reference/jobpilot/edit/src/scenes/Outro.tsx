import type { ReactElement } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { PILOT_TOTAL } from "../clock";
import { Caption } from "../components/Caption";
import { Kinetic, words } from "../components/Kinetic";
import { LogoReveal } from "../components/Logo";
import { Pulse } from "../components/Overlays";
import { AppWindow, Footage, useEnter } from "../components/Shot";
import { CLIPS, SPOT } from "../shots";
import { alpha, c, clamp, easeOut, fonts, SECTIONS } from "../theme";
import { Centered } from "./Layout";

// pickups.mp4 at 0.4s: the Pilot thread right after the run.
const PICKUP_AT = 0.4;
const { pickups } = CLIPS;

/** The thread's "Applied to WitnessAI" turn. */
export function Payoff(): ReactElement {
  const { frames } = SECTIONS.payoff;
  return (
    <>
      <Centered>
        <AppWindow w={1600} h={900} url="jobpilot.suxrobgm.net">
          <Footage
            src={pickups.src}
            sw={pickups.sw}
            sh={pickups.sh}
            w={1600}
            h={900}
            cams={[
              { f: 0, x: 1650, y: 1050, z: 1.35 },
              { f: frames, x: 1560, y: 1170, z: 1.85 },
            ]}
            startFrom={PICKUP_AT}
          >
            <Pulse {...SPOT.appliedTurn} at={40} size={180} />
          </Footage>
        </AppWindow>
      </Centered>
      <Caption text="Applied. *Logged in your pipeline.*" at={30} outAt={frames - 10} size={60} />
    </>
  );
}

/** Where it runs and who sets the limits, beside the Pilot's rules card. */
export function Trust(): ReactElement {
  const card = useEnter(18, 28);
  return (
    <AbsoluteFill
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 100 }}
    >
      <Kinetic
        lines={[words("Your machine."), words("Your Claude Code."), words("Your *rules.*")]}
        at={6}
        stagger={5}
        size={84}
        align="left"
        outAt={SECTIONS.trust.frames - 14}
      />
      <div
        style={{
          ...card.style,
          borderRadius: 8,
          overflow: "hidden",
          border: `1px solid ${c.borderHi}`,
        }}
      >
        <Footage
          src={pickups.src}
          sw={pickups.sw}
          sh={pickups.sh}
          w={600}
          h={420}
          cams={[{ f: 0, ...SPOT.rulesCard, z: 5.33 }]}
          startFrom={PICKUP_AT}
          rate={0.5}
        />
      </div>
    </AbsoluteFill>
  );
}

interface TallyProps {
  label: string;
  value: number;
  sub: string;
  flame: boolean;
}

function Tally(props: TallyProps): ReactElement {
  const { label, value, sub, flame } = props;
  const color = flame ? c.flame : c.text;
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: "0.18em", color: c.text3 }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: fonts.display,
          fontWeight: 800,
          fontSize: 220,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          color,
          textShadow: flame ? `0 0 60px ${alpha(c.flame, 0.45)}` : undefined,
        }}
      >
        {value}
      </div>
      <div style={{ fontFamily: fonts.mono, fontSize: 22, color: c.text2 }}>{sub}</div>
    </div>
  );
}

const LOGO_AT = 118;

/** The film's tally, then the logo, headline and URL. */
export function Close(): ReactElement {
  const f = useCurrentFrame();
  const show = interpolate(f, [0, 16, 100, 116], [0, 1, 1, 0], { ...clamp, easing: easeOut });
  return (
    <>
      <Centered>
        <div
          style={{
            display: "flex",
            gap: 120,
            alignItems: "flex-end",
            opacity: show,
            transform: `scale(${0.94 + 0.06 * show})`,
          }}
        >
          <Tally label="PILOT" value={PILOT_TOTAL} sub="real tool calls" flame={false} />
          <Tally label="YOU" value={2} sub="clicks" flame />
        </div>
      </Centered>
      <Sequence from={LOGO_AT}>
        <Centered>
          <LogoReveal
            size={140}
            tagline="An AI agent that applies to jobs for you."
            sub="jobpilot.suxrobgm.net"
          />
        </Centered>
      </Sequence>
    </>
  );
}

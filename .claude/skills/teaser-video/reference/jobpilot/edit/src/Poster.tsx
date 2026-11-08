import type { ReactElement } from "react";
import { AbsoluteFill } from "remotion";
import { PILOT_TOTAL } from "./clock";
import { Background, Vignette } from "./components/Background";
import { AppWindow, Footage } from "./components/Shot";
import { CLIPS } from "./shots";
import { alpha, c, fonts } from "./theme";

// ask-web.mp4 at 14.4s: the user's request, the Pilot's live reply turn, and the composer.
const CHAT_AT = 14.4;
const { askWeb } = CLIPS;

/** Landing poster: the Pilot chat, under the film's tally. */
export function Poster(): ReactElement {
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 92, gap: 54 }}>
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 92,
            lineHeight: 1,
            letterSpacing: "-0.035em",
            color: c.text,
          }}
        >
          It did {PILOT_TOTAL} things.{" "}
          <span style={{ color: c.flame, textShadow: `0 0 40px ${alpha(c.flame, 0.4)}` }}>
            You did 2.
          </span>
        </div>
        <AppWindow w={1500} h={640} url="jobpilot.suxrobgm.net/pilot">
          <Footage
            src={askWeb.src}
            sw={askWeb.sw}
            sh={askWeb.sh}
            w={1500}
            h={640}
            cams={[{ f: 0, x: 1720, y: 1500, z: 2 }]}
            startFrom={CHAT_AT}
          />
        </AppWindow>
      </AbsoluteFill>
      <Vignette strength={0.4} />
    </AbsoluteFill>
  );
}

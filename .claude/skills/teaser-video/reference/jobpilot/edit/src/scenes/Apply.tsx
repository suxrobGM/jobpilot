import type { ReactElement } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { FOOTAGE, lengthOf } from "../clock";
import { Kinetic, words } from "../components/Kinetic";
import { Pulse, Spotlight } from "../components/Overlays";
import { BROWSER_CAM, SPOT } from "../shots";
import { c, clamp, SECTIONS } from "../theme";
import { Split, Tag, WebShot } from "./Layout";

// Camera target for the Apply now close-up: just left of and below the button itself.
const APPLY_NOW_CLOSE = { x: 2640, y: 360 };

/** Your call: open the chosen job from the new search and hover Apply now. */
export function Pause(): ReactElement {
  const f = useCurrentFrame();
  // Mute the colors a little so the flame spotlight is the only warm thing on screen.
  const calm = interpolate(f, [0, 30], [0, 1], clamp);
  return (
    <>
      <AbsoluteFill style={{ filter: `saturate(${1 - 0.15 * calm})` }}>
        <WebShot
          segment={FOOTAGE.pickJob}
          cams={[
            { f: 0, x: 1200, y: 1100, z: 1.25 },
            { f: 100, x: 1900, y: 800, z: 1.2 },
            { f: 170, ...APPLY_NOW_CLOSE, y: 420, z: 2.1 },
            { f: SECTIONS.pause.frames, ...APPLY_NOW_CLOSE, z: 2.4 },
          ]}
        >
          <Spotlight x={2572} y={298} w={168} h={74} at={150} dim={0.55} radius={10} />
        </WebShot>
      </AbsoluteFill>
      <Tag text="Your call" at={8} />
    </>
  );
}

/** You: 2. The click, then the applier's terminal beside the real application page. */
export function Submit(): ReactElement {
  const press = lengthOf(FOOTAGE.pressApply);
  const split = lengthOf(FOOTAGE.applySplit);
  return (
    <>
      <Sequence durationInFrames={press}>
        <WebShot
          segment={FOOTAGE.pressApply}
          cams={[
            { f: 0, ...APPLY_NOW_CLOSE, z: 2.4 },
            { f: 30, ...APPLY_NOW_CLOSE, z: 2.6 },
          ]}
        >
          <Pulse {...SPOT.applyNow} at={4} color={c.flame} size={140} />
        </WebShot>
      </Sequence>
      <Sequence from={press} durationInFrames={split}>
        <Split
          terminal={FOOTAGE.applySplit}
          terminalSub="job-applier agent"
          browser={{
            clip: "applyAgent",
            sub: "the real application",
            cams: [
              BROWSER_CAM,
              { ...BROWSER_CAM, f: split - 90 },
              { f: split, x: 1160, y: 1000, z: 1.5 },
            ],
            // From the hiring.cafe posting through Ashby's overview to the application form.
            startFrom: 19.8,
            rate: 4.83,
          }}
        />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 34 }}>
          <Kinetic
            lines={[words("Tailors your resume. Fills the form. *Submits.*")]}
            at={40}
            size={48}
            weight={700}
            outAt={split - 20}
          />
        </div>
      </Sequence>
    </>
  );
}

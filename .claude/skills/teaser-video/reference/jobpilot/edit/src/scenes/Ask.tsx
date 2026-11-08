import type { ReactElement } from "react";
import { Sequence } from "remotion";
import { FOOTAGE, lengthOf } from "../clock";
import { Caption } from "../components/Caption";
import { BROWSER_CAM, SENT, SPOT } from "../shots";
import { SECTIONS } from "../theme";
import { Split, Tag, WebShot } from "./Layout";

/** You: 1. The user types one request in the Pilot composer and sends it. */
export function Start(): ReactElement {
  const sent = SENT - SECTIONS.start.from;
  return (
    <>
      <WebShot
        segment={FOOTAGE.typing}
        cams={[
          { f: 0, x: 1600, y: 900, z: 1 },
          { f: 100, ...SPOT.composer, z: 1.85 },
          { f: sent + 20, ...SPOT.composer, z: 1.85 },
          { f: sent + 70, ...SPOT.sentMessage, z: 1.6 },
        ]}
      />
      <Tag text="One ask" at={14} outAt={SECTIONS.start.frames - 16} />
    </>
  );
}

/** The Agent drawer slides in and Claude Code picks up the chat run. */
export function Handoff(): ReactElement {
  const opening = lengthOf(FOOTAGE.drawerOpens);
  const drawer = { x: SPOT.terminal.x, y: 700 };
  return (
    <>
      <Sequence durationInFrames={opening}>
        <WebShot
          segment={FOOTAGE.drawerOpens}
          cams={[
            { f: 0, ...SPOT.sentMessage, z: 1.6 },
            { f: 70, x: 2300, y: 900, z: 1.25 },
            { f: 120, ...drawer, z: 2.3 },
          ]}
        />
      </Sequence>
      <Sequence from={opening} durationInFrames={lengthOf(FOOTAGE.chatRun)}>
        <WebShot
          segment={FOOTAGE.chatRun}
          cams={[
            { f: 0, ...drawer, z: 2.3 },
            { f: 120, x: SPOT.terminal.x, y: 800, z: 2.6 },
          ]}
        />
      </Sequence>
      <Caption
        text="Claude Code *takes it* from here."
        at={opening - 30}
        outAt={SECTIONS.handoff.frames - 12}
        size={64}
      />
    </>
  );
}

/** The search: terminal close-up, then the terminal beside its browser on hiring.cafe. */
export function Hero(): ReactElement {
  const closeUp = lengthOf(FOOTAGE.searchStarts);
  const split = lengthOf(FOOTAGE.searchSplit);
  return (
    <>
      <Sequence durationInFrames={closeUp}>
        <WebShot
          segment={FOOTAGE.searchStarts}
          cams={[
            { f: 0, x: SPOT.terminal.x, y: 800, z: 2.6 },
            { f: closeUp, x: SPOT.terminal.x, y: 860, z: 3.0 },
          ]}
        />
        <Caption text="It searches the board *you named.*" at={20} outAt={closeUp - 14} size={60} />
      </Sequence>
      <Sequence from={closeUp} durationInFrames={split}>
        <Split
          terminal={FOOTAGE.searchSplit}
          terminalSub="in the JobPilot terminal"
          browser={{
            clip: "askAgent",
            sub: "hiringcafe.com, live",
            cams: [BROWSER_CAM, { f: split, x: 938, y: 980, z: 1.3 }],
            // 33.5s skips the hiring.cafe login modal, which shows the user's email.
            startFrom: 33.5,
            rate: FOOTAGE.searchSplit.rate,
          }}
        />
      </Sequence>
    </>
  );
}

import type { ReactElement, ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { browserCallFrames, type Segment } from "../clock";
import { Eyebrow } from "../components/Kinetic";
import { Pulses } from "../components/Pulses";
import { AppWindow, type Cam, Footage, useEnter } from "../components/Shot";
import { CLIPS, type ClipName, PANE, TERMINAL_CAM } from "../shots";
import { c, fonts } from "../theme";

interface ChildrenProps {
  children: ReactNode;
}

export function Centered(props: ChildrenProps): ReactElement {
  const { children } = props;
  return <AbsoluteFill style={{ display: "grid", placeItems: "center" }}>{children}</AbsoluteFill>;
}

interface TagProps {
  text: string;
  at: number;
  outAt?: number;
}

/** Flame eyebrow above the window: the beats that belong to the user. */
export function Tag(props: TagProps): ReactElement {
  const { text, at, outAt } = props;
  return (
    <div style={{ position: "absolute", left: 160, top: 26 }}>
      <Eyebrow text={text} at={at} outAt={outAt} color={c.flame} />
    </div>
  );
}

interface WebShotProps {
  segment: Segment;
  cams: Cam[];
  children?: ReactNode;
}

/** The JobPilot web app, full window, playing one footage segment. */
export function WebShot(props: WebShotProps): ReactElement {
  const { segment, cams, children } = props;
  const clip = CLIPS[segment.clip];
  return (
    <Centered>
      <AppWindow w={1600} h={900} url="jobpilot.suxrobgm.net">
        <Footage
          src={clip.src}
          sw={clip.sw}
          sh={clip.sh}
          w={1600}
          h={900}
          cams={cams}
          startFrom={segment.src}
          rate={segment.rate}
        >
          {children}
        </Footage>
      </AppWindow>
    </Centered>
  );
}

interface PaneProps extends ChildrenProps {
  x: number;
  w: number;
  label: string;
  sub: string;
}

function Pane(props: PaneProps): ReactElement {
  const { x, w, label, sub, children } = props;
  const enter = useEnter(0, 26);
  return (
    <div style={{ position: "absolute", left: x, top: PANE.top - 56, width: w, ...enter.style }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, height: 44 }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 26, color: c.text }}>
          {label}
        </div>
        <div style={{ fontFamily: fonts.mono, fontSize: 16, color: c.text3 }}>{sub}</div>
      </div>
      <div
        style={{
          marginTop: 12,
          borderRadius: 8,
          overflow: "hidden",
          border: `1px solid ${c.borderHi}`,
          boxShadow: "0 40px 110px rgba(0,0,0,0.65)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

interface BrowserFootage {
  clip: ClipName;
  sub: string;
  cams: Cam[];
  startFrom: number;
  rate: number;
}

interface SplitProps {
  /** The terminal footage; its browser tool calls spark across to the browser pane. */
  terminal: Segment;
  terminalSub: string;
  browser: BrowserFootage;
}

/** Claude Code's terminal beside its browser, with a spark per real browser tool call. */
export function Split(props: SplitProps): ReactElement {
  const { terminal, terminalSub, browser } = props;
  const terminalClip = CLIPS[terminal.clip];
  const browserClip = CLIPS[browser.clip];
  return (
    <>
      <Pane x={PANE.leftX} w={PANE.leftW} label="Claude Code" sub={terminalSub}>
        <Footage
          src={terminalClip.src}
          sw={terminalClip.sw}
          sh={terminalClip.sh}
          w={PANE.leftW}
          h={PANE.h}
          cams={TERMINAL_CAM}
          startFrom={terminal.src}
          rate={terminal.rate}
        />
      </Pane>
      <Pane x={PANE.rightX} w={PANE.rightW} label="Its browser" sub={browser.sub}>
        <Footage
          src={browserClip.src}
          sw={browserClip.sw}
          sh={browserClip.sh}
          w={PANE.rightW}
          h={PANE.h}
          cams={browser.cams}
          startFrom={browser.startFrom}
          rate={browser.rate}
        />
      </Pane>
      <Pulses
        frames={browserCallFrames(terminal)}
        offset={terminal.from}
        from={{ x: PANE.leftX + PANE.leftW - 40, y: PANE.top + 300 }}
        to={{ x: PANE.rightX + 60, y: PANE.top + 360 }}
      />
    </>
  );
}

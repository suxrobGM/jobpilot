import type { ComponentType, ReactElement } from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { pilotCount } from "./clock";
import { Background, Vignette } from "./components/Background";
import { Hud } from "./components/Hud";
import { SoundTrack } from "./components/Sound";
import { CUES } from "./cues";
import { Pause, Submit } from "./scenes/Apply";
import { Handoff, Hero, Start } from "./scenes/Ask";
import { Hook, Reveal } from "./scenes/Intro";
import { Close, Payoff, Trust } from "./scenes/Outro";
import { youCount } from "./shots";
import { SECTIONS, TOTAL_FRAMES } from "./theme";

type SectionName = keyof typeof SECTIONS;

// One scene per storyboard section, in film order.
const SCENES: [SectionName, ComponentType][] = [
  ["hook", Hook],
  ["reveal", Reveal],
  ["start", Start],
  ["handoff", Handoff],
  ["hero", Hero],
  ["pause", Pause],
  ["submit", Submit],
  ["payoff", Payoff],
  ["trust", Trust],
  ["close", Close],
];

export function Teaser(): ReactElement {
  return (
    <AbsoluteFill>
      <Background />
      {SCENES.map(([name, Scene]) => (
        <Sequence key={name} from={SECTIONS[name].from} durationInFrames={SECTIONS[name].frames}>
          <Scene />
        </Sequence>
      ))}
      <Hud pilot={pilotCount} you={youCount} from={SECTIONS.start.from} to={SECTIONS.payoff.from} />
      <Vignette strength={0.45} />
      <SoundTrack cues={CUES} total={TOTAL_FRAMES} />
    </AbsoluteFill>
  );
}

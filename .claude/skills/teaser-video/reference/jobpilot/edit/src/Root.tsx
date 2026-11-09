import type { ReactElement } from "react";
import { Composition } from "remotion";
import { Poster } from "./Poster";
import { Teaser } from "./Teaser";
import { FPS, TOTAL_FRAMES } from "./theme";

export function Root(): ReactElement {
  return (
    <>
      <Composition
        id="Teaser"
        component={Teaser}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="Poster"
        component={Poster}
        durationInFrames={1}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
}

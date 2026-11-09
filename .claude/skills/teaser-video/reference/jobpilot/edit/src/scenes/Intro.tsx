import type { ReactElement } from "react";
import { FormStack } from "../components/FormStack";
import { Kinetic, words } from "../components/Kinetic";
import { LogoReveal } from "../components/Logo";
import { SECTIONS } from "../theme";
import { Centered } from "./Layout";

/** The pain, before any UI: forms stacking up faster and faster. */
export function Hook(): ReactElement {
  const { frames } = SECTIONS.hook;
  return (
    <>
      <FormStack dur={frames} />
      <Centered>
        <Kinetic
          lines={[words("Applying to jobs"), words("is a *second* *job.*")]}
          at={10}
          size={118}
          outAt={frames - 16}
        />
      </Centered>
    </>
  );
}

export function Reveal(): ReactElement {
  return (
    <Centered>
      <LogoReveal size={150} />
    </Centered>
  );
}

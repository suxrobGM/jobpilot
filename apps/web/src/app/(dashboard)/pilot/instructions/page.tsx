import type { ReactElement } from "react";
import type { Metadata } from "next";
import { InstructionsTab } from "@/components/features/pilot";

export const metadata: Metadata = { title: "Instructions" };

export default function PilotInstructionsPage(): ReactElement {
  return <InstructionsTab />;
}

import type { ReactElement } from "react";
import type { Metadata } from "next";
import { JournalFeed } from "@/components/features/pilot";

export const metadata: Metadata = { title: "Activity" };

export default function PilotActivityPage(): ReactElement {
  return <JournalFeed />;
}

import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import type { Metadata } from "next";
import { CycleCost, JournalFeed } from "@/components/features/pilot";

export const metadata: Metadata = { title: "Activity" };

export default function PilotActivityPage(): ReactElement {
  return (
    <Stack spacing={2}>
      <JournalFeed />
      <CycleCost />
    </Stack>
  );
}
